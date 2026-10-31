import NetInfo from '@react-native-community/netinfo';
import {
    createUserWithEmailAndPassword,
    EmailAuthProvider,
    onAuthStateChanged,
    reauthenticateWithCredential,
    sendPasswordResetEmail,
    signInWithEmailAndPassword,
    signOut as firebaseSignOut,
    User,
} from 'firebase/auth';
import { v4 as uuidv4 } from 'uuid';
import { create } from 'zustand';
import { HouseholdMember, Invite, Role, SYNCED_TABLES } from '../domain/types';
import { META, openLocalDatabase, seedStarterRecipes } from '../data/bootstrap';
import { getDb } from '../data/db';
import { createAdapter } from '../data/storage/createAdapter';
import { MemoryAdapter } from '../data/storage/memoryAdapter';
import { httpsCallable } from 'firebase/functions';
import { auth, functions, isBackendConfigured } from '../services/firebase';
import * as backend from '../services/household';
import { configurePurchases, onProStatusChange } from '../services/purchases';
import { usePrefs } from './prefs';
import { syncController } from './sync';

export type Membership = backend.Membership;

interface SessionState {
    ready: boolean;
    storageWarning: string | null;
    onboarded: boolean;
    user: backend.SignedInUser | null;
    memberships: Membership[];
    householdName: string;
    role: Role;
    members: HouseholdMember[];
    storePro: boolean | null; // RevenueCat on this device
    accountPro: boolean; // server-side subscription (webhook)
    linking: boolean;
    /** The account's household is known server-side; sync may run. */
    linked: boolean;

    boot: () => Promise<void>;
    completeOnboarding: () => Promise<void>;
    signIn: (email: string, password: string) => Promise<void>;
    signUp: (email: string, password: string) => Promise<'signed-in' | 'confirm-email'>;
    resetPassword: (email: string) => Promise<void>;
    signOut: () => Promise<void>;
    refreshHousehold: () => Promise<void>;
    switchHousehold: (householdId: string) => Promise<void>;
    renameHousehold: (name: string) => Promise<void>;
    createInvite: (role: 'editor' | 'viewer') => Promise<Invite>;
    joinHousehold: (code: string) => Promise<void>;
    setMemberRole: (userId: string, role: 'editor' | 'viewer') => Promise<void>;
    removeMember: (userId: string) => Promise<void>;
    leaveHousehold: () => Promise<void>;
    /** Permanently delete the account and its data (password re-check first). */
    deleteAccount: (password: string) => Promise<void>;
    /** Signed out: wipe everything stored on this device. */
    deleteLocalData: () => Promise<void>;
    setStorePro: (pro: boolean | null) => void;
}

export const useIsPro = () => useSession(s => s.storePro === true || s.accountPro);

function requireAuth() {
    if (!auth) throw new Error('Accounts are not configured for this build.');
    return auth;
}

const AUTH_MESSAGES: Record<string, string> = {
    'auth/invalid-credential': 'Email or password is incorrect.',
    'auth/wrong-password': 'Email or password is incorrect.',
    'auth/user-not-found': 'Email or password is incorrect.',
    'auth/invalid-email': 'Enter a valid email address.',
    'auth/email-already-in-use': 'An account with this email already exists. Sign in instead.',
    'auth/weak-password': 'Choose a stronger password (at least 8 characters, with a letter and a number).',
    'auth/too-many-requests': 'Too many attempts. Wait a few minutes and try again.',
    'auth/network-request-failed': "Can't reach the server. Check your connection and try again.",
    'auth/user-disabled': 'This account has been disabled.',
    'auth/operation-not-allowed': "Email sign-in isn't switched on for this app yet.",
    'auth/configuration-not-found': "Email sign-in isn't switched on for this app yet.",
};

/** Friendly text for Firebase Auth errors. */
function authError(e: unknown): Error {
    const code = (e as { code?: string } | undefined)?.code;
    return new Error((code && AUTH_MESSAGES[code]) || (e instanceof Error ? e.message : 'Something went wrong. Try again.'));
}

const toUser = (u: User): backend.SignedInUser => ({ id: u.uid, email: u.email });

let authUnsubscribe: (() => void) | null = null;
let proUnsubscribe: (() => void) | null = null;

export const useSession = create<SessionState>((set, get) => {
    /** After sign-in: attach this device's data to the account's household and start syncing. */
    async function linkAccount(firebaseUser: User) {
        const db = getDb();
        const user = toUser(firebaseUser);
        set({ user, linking: true });
        await db.setMeta(META.userId, user.id);
        db.setHousehold(db.householdId, user.id);

        const pro = configurePurchases(user.id).then(storePro => set({ storePro }));
        try {
            const hid = await backend.bootstrapHousehold(user, db.householdId);
            if (hid !== db.householdId) {
                // The account already has a household: drop starter recipes this
                // device never touched (the account has its own), keep everything else.
                for (const r of db.list('recipes')) {
                    if (r.sourceName === 'GroceryCompanion' && r.createdAt === r.updatedAt) db.discardLocal('recipes', r.id);
                }
                await db.reassignHousehold(db.householdId, hid);
                await db.setMeta(META.activeHouseholdId, hid);
                db.setHousehold(hid, user.id);
            }
            set({ linked: true });
            await usePrefs.getState().pullFromProfile(user.id);
            await get().refreshHousehold();
            syncController.start(user.id, db.householdId, () => void get().refreshHousehold());
        } catch (e) {
            // Offline (e.g. the app restored a session without network): keep working
            // locally and finish linking once we're back online. Syncing before
            // the household exists would only produce permission errors.
            console.warn('Household link deferred:', (e as Error).message);
            const unsubscribe = NetInfo.addEventListener(s => {
                if (s.isConnected && s.isInternetReachable !== false && !get().linked && get().user?.id === user.id) {
                    unsubscribe();
                    void linkAccount(firebaseUser);
                }
            });
        } finally {
            set({ linking: false });
        }
        await pro;
    }

    // Sign-out (and account deletion) reset the device both directly and via the
    // auth listener; run one reset at a time or two interleave and leave a second,
    // orphaned copy of the starter data whose uploads can never succeed.
    let resetting: Promise<void> | null = null;
    function resetToLocal(): Promise<void> {
        if (!resetting) resetting = doResetToLocal().finally(() => (resetting = null));
        return resetting;
    }

    async function doResetToLocal() {
        syncController.stop();
        const db = getDb();
        await db.clearAll();
        const localId = uuidv4();
        await db.setMeta(META.localHouseholdId, localId);
        await db.setMeta(META.seeded, '1');
        await db.setMeta(META.legacyMigrated, '1');
        await db.setMeta(META.seedImagesFixed, '1');
        await db.setMeta(META.onboarded, '1');
        db.setHousehold(localId, null);
        seedStarterRecipes(db);
        await db.flush();
        set({ user: null, linked: false, memberships: [], members: [], role: 'owner', householdName: 'My Household', accountPro: false });
    }

    async function refresh() {
        const { user, linked } = get();
        if (!isBackendConfigured || !user || !linked) return;
        const db = getDb();
        const memberships = await backend.myMemberships(user.id);

        // Forget data from households we no longer belong to.
        const ids = new Set(memberships.map(m => m.household.id));
        const localHouseholds = new Set(SYNCED_TABLES.flatMap(t => db.all(t).map(r => r.householdId)));
        for (const hid of localHouseholds) if (!ids.has(hid) && hid !== db.householdId) await db.removeHouseholdData(hid);

        if (!memberships.length) {
            // Our only household was deleted by its owner: start a fresh one of our own.
            await db.removeHouseholdData(db.householdId);
            const own = await backend.ownHousehold(user);
            await syncController.engine?.resetCursors();
            await db.setMeta(META.activeHouseholdId, own);
            db.setHousehold(own, user.id);
            syncController.start(user.id, own, () => void get().refreshHousehold());
            return refresh();
        }

        let active = memberships.find(m => m.household.id === db.householdId);
        if (!active && memberships.length) {
            // Removed from the active household: switch to another one.
            await db.removeHouseholdData(db.householdId);
            active = memberships.find(m => m.role === 'owner') ?? memberships[0];
            await syncController.engine?.resetCursors();
            await db.setMeta(META.activeHouseholdId, active.household.id);
            db.setHousehold(active.household.id, user.id);
            syncController.start(user.id, active.household.id, () => void get().refreshHousehold());
        }

        const [members, accountPro] = await Promise.all([
            active ? backend.loadMembers(db.householdId) : Promise.resolve([]),
            backend.loadAccountPro(user.id).catch(() => false),
        ]);
        set({
            memberships,
            role: active?.role ?? 'owner',
            householdName: active?.household.name ?? 'My Household',
            members,
            accountPro,
        });
    }

    function requireUser() {
        const { user } = get();
        if (!user) throw new Error('Sign in first.');
        return user;
    }

    return {
        ready: false,
        storageWarning: null,
        onboarded: false,
        user: null,
        memberships: [],
        householdName: 'My Household',
        role: 'owner',
        members: [],
        storePro: null,
        accountPro: false,
        linking: false,
        linked: false,

        boot: async () => {
            let storageWarning: string | null = null;
            try {
                await openLocalDatabase(createAdapter());
            } catch (e) {
                // e.g. private browsing with storage disabled: keep the app usable.
                storageWarning = `Data can't be saved on this device (${(e as Error).message}). Changes will be lost when you close the app.`;
                await openLocalDatabase(new MemoryAdapter());
            }
            const db = getDb();
            db.onError(err => set({ storageWarning: err.message }));
            await usePrefs.getState().load();
            syncController.init();
            const onboarded = (await db.getMeta(META.onboarded)) === '1';
            set({ ready: true, onboarded, storageWarning });

            proUnsubscribe?.();
            proUnsubscribe = onProStatusChange(pro => set({ storePro: pro }));

            if (!isBackendConfigured || !auth) {
                set({ storePro: await configurePurchases(null) });
                return;
            }
            // Fires once with the restored session (or null), then on every sign-in/out.
            let first = true;
            authUnsubscribe?.();
            authUnsubscribe = onAuthStateChanged(auth, firebaseUser => {
                const wasFirst = first;
                first = false;
                if (firebaseUser && firebaseUser.uid !== get().user?.id) void linkAccount(firebaseUser);
                else if (!firebaseUser && get().user) void resetToLocal();
                else if (!firebaseUser && wasFirst) void configurePurchases(null).then(storePro => set({ storePro }));
            });
        },

        completeOnboarding: async () => {
            await getDb().setMeta(META.onboarded, '1');
            set({ onboarded: true });
        },

        signIn: async (email, password) => {
            try {
                await signInWithEmailAndPassword(requireAuth(), email, password);
            } catch (e) {
                throw authError(e);
            }
            await get().completeOnboarding();
        },

        signUp: async (email, password) => {
            try {
                await createUserWithEmailAndPassword(requireAuth(), email, password);
            } catch (e) {
                throw authError(e);
            }
            await get().completeOnboarding();
            return 'signed-in';
        },

        resetPassword: async email => {
            try {
                await sendPasswordResetEmail(requireAuth(), email);
            } catch (e) {
                // Don't reveal whether an account exists.
                if ((e as { code?: string }).code !== 'auth/user-not-found') throw authError(e);
            }
        },

        signOut: async () => {
            const a = requireAuth();
            await syncController.engine?.syncNow().catch(() => undefined);
            await firebaseSignOut(a);
            // onAuthStateChanged(null) wipes this device's copy; do it here too in case it fired early.
            if (get().user) await resetToLocal();
            set({ storePro: await configurePurchases(null) });
        },

        refreshHousehold: async () => {
            try {
                await refresh();
            } catch (e) {
                // Background refreshes run offline too; the next one will catch up.
                console.warn('Household refresh failed:', (e as Error).message);
            }
        },

        switchHousehold: async householdId => {
            const user = requireUser();
            const db = getDb();
            await db.setMeta(META.activeHouseholdId, householdId);
            db.setHousehold(householdId, user.id);
            syncController.start(user.id, householdId, () => void get().refreshHousehold());
            await get().refreshHousehold();
        },

        renameHousehold: async name => {
            await backend.renameHousehold(getDb().householdId, name);
            await get().refreshHousehold();
        },

        createInvite: async role => backend.createInvite(getDb().householdId, requireUser().id, role),

        joinHousehold: async code => {
            const hid = await backend.acceptInvite(code, requireUser());
            await get().switchHousehold(hid);
        },

        setMemberRole: async (userId, role) => {
            await backend.setMemberRole(getDb().householdId, userId, role);
            await get().refreshHousehold();
        },

        removeMember: async userId => {
            await backend.removeMember(getDb().householdId, userId);
            await get().refreshHousehold();
        },

        leaveHousehold: async () => {
            const user = requireUser();
            const db = getDb();
            const leaving = db.householdId;
            await backend.removeMember(leaving, user.id);
            const hid = await backend.ownHousehold(user);
            await get().switchHousehold(hid);
            await db.removeHouseholdData(leaving);
        },

        deleteAccount: async password => {
            const a = requireAuth();
            const current = a.currentUser;
            if (!current?.email || !functions) throw new Error('Sign in first.');
            try {
                await reauthenticateWithCredential(current, EmailAuthProvider.credential(current.email, password));
            } catch (e) {
                throw authError(e);
            }
            syncController.stop();
            try {
                await httpsCallable(functions, 'deleteAccount')();
            } catch (e) {
                syncController.start(current.uid, getDb().householdId, () => void get().refreshHousehold());
                throw new Error((e as Error).message || 'Your account could not be deleted. Please try again.');
            }
            // The account no longer exists; sign out locally and wipe this device's copy.
            await firebaseSignOut(a).catch(() => undefined);
            await resetToLocal();
            await usePrefs.getState().reset();
            set({ storePro: await configurePurchases(null) });
        },

        deleteLocalData: async () => {
            await resetToLocal();
            await usePrefs.getState().reset();
        },

        setStorePro: pro => set({ storePro: pro }),
    };
});
