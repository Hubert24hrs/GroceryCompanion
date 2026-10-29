import NetInfo from '@react-native-community/netinfo';
import { Session } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { create } from 'zustand';
import { Household, HouseholdMember, Invite, Role, SYNCED_TABLES } from '../domain/types';
import { META, openLocalDatabase, seedStarterRecipes } from '../data/bootstrap';
import { getDb } from '../data/db';
import { createAdapter } from '../data/storage/createAdapter';
import { MemoryAdapter } from '../data/storage/memoryAdapter';
import { configurePurchases, onProStatusChange } from '../services/purchases';
import { supabase } from '../services/supabase';
import { usePrefs } from './prefs';
import { syncController } from './sync';

export interface Membership {
    household: Household;
    role: Role;
}

interface SessionState {
    ready: boolean;
    storageWarning: string | null;
    onboarded: boolean;
    user: { id: string; email: string | null } | null;
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
    setStorePro: (pro: boolean | null) => void;
}

export const useIsPro = () => useSession(s => s.storePro === true || s.accountPro);

function requireClient() {
    if (!supabase) throw new Error('Accounts are not configured for this build.');
    return supabase;
}

/** Friendlier text for errors raised by our RPCs (they carry a hint). */
function rpcError(error: { message: string; hint?: string | null }): Error {
    return new Error(error.hint || error.message);
}

let authUnsubscribe: (() => void) | null = null;
let proUnsubscribe: (() => void) | null = null;

export const useSession = create<SessionState>((set, get) => {
    /** After sign-in: attach this device's data to the account's household and start syncing. */
    async function linkAccount(session: Session) {
        const db = getDb();
        const client = requireClient();
        const user = { id: session.user.id, email: session.user.email ?? null };
        set({ user, linking: true });
        await db.setMeta(META.userId, user.id);
        db.setHousehold(db.householdId, user.id);

        const pro = configurePurchases(user.id).then(storePro => set({ storePro }));
        try {
            const { data: hid, error } = await client.rpc('bootstrap_household', {
                p_household_id: db.householdId,
                p_name: 'My Household',
            });
            if (error) throw error;
            if (hid && hid !== db.householdId) {
                // The account already has a household: drop starter recipes this
                // device never touched (the account has its own), keep everything else.
                for (const r of db.list('recipes')) {
                    if (r.sourceName === 'GroceryCompanion' && r.createdAt === r.updatedAt) db.discardLocal('recipes', r.id);
                }
                await db.reassignHousehold(db.householdId, hid as string);
                await db.setMeta(META.activeHouseholdId, hid as string);
                db.setHousehold(hid as string, user.id);
            }
            set({ linked: true });
            await usePrefs.getState().pullFromProfile(user.id);
            await get().refreshHousehold();
            syncController.start(user.id, db.householdId, () => void get().refreshHousehold());
        } catch (e) {
            // Offline (e.g. app restored a session without network): keep working
            // locally and finish linking once we're back online. Syncing before
            // the household exists would only produce permission errors.
            console.warn('Household link deferred:', (e as Error).message);
            const unsubscribe = NetInfo.addEventListener(s => {
                if (s.isConnected && s.isInternetReachable !== false && !get().linked) {
                    unsubscribe();
                    void linkAccount(session);
                }
            });
        } finally {
            set({ linking: false });
        }
        await pro;
    }

    async function resetToLocal() {
        syncController.stop();
        const db = getDb();
        await db.clearAll();
        const localId = uuidv4();
        await db.setMeta(META.localHouseholdId, localId);
        await db.setMeta(META.seeded, '1');
        await db.setMeta(META.legacyMigrated, '1');
        await db.setMeta(META.onboarded, '1');
        db.setHousehold(localId, null);
        seedStarterRecipes(db);
        await db.flush();
        set({ user: null, linked: false, memberships: [], members: [], role: 'owner', householdName: 'My Household', accountPro: false });
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

            if (!supabase) {
                set({ storePro: await configurePurchases(null) });
                return;
            }
            const { data } = await supabase.auth.getSession();
            if (data.session) void linkAccount(data.session);
            else set({ storePro: await configurePurchases(null) });

            authUnsubscribe?.();
            const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
                if (event === 'SIGNED_IN' && session && session.user.id !== get().user?.id) void linkAccount(session);
                if (event === 'SIGNED_OUT' && get().user) void resetToLocal();
            });
            authUnsubscribe = () => sub.subscription.unsubscribe();
        },

        completeOnboarding: async () => {
            await getDb().setMeta(META.onboarded, '1');
            set({ onboarded: true });
        },

        signIn: async (email, password) => {
            const { error } = await requireClient().auth.signInWithPassword({ email, password });
            if (error) throw new Error(error.message === 'Invalid login credentials' ? 'Email or password is incorrect.' : error.message);
            await get().completeOnboarding();
        },

        signUp: async (email, password) => {
            const { data, error } = await requireClient().auth.signUp({ email, password });
            if (error) throw error;
            await get().completeOnboarding();
            return data.session ? 'signed-in' : 'confirm-email';
        },

        resetPassword: async email => {
            const { error } = await requireClient().auth.resetPasswordForEmail(email);
            if (error) throw error;
        },

        signOut: async () => {
            const client = requireClient();
            await syncController.engine?.syncNow().catch(() => undefined);
            const { error } = await client.auth.signOut();
            if (error) throw error;
            // onAuthStateChange(SIGNED_OUT) wipes this device's copy; do it here too in case it fired early.
            if (get().user) await resetToLocal();
            set({ storePro: await configurePurchases(null) });
        },

        refreshHousehold: async () => {
            const { user, linked } = get();
            if (!supabase || !user || !linked) return;
            const db = getDb();
            const { data, error } = await supabase
                .from('household_members')
                .select('role, households(id, name, owner_id)')
                .eq('user_id', user.id);
            if (error) throw error;
            const memberships: Membership[] = (data ?? [])
                .filter((m: any) => m.households)
                .map((m: any) => ({
                    role: m.role as Role,
                    household: { id: m.households.id, name: m.households.name, ownerId: m.households.owner_id },
                }));

            // Forget data from households we no longer belong to.
            const ids = new Set(memberships.map(m => m.household.id));
            const localHouseholds = new Set(SYNCED_TABLES.flatMap(t => db.all(t).map(r => r.householdId)));
            for (const hid of localHouseholds) if (!ids.has(hid) && hid !== db.householdId) await db.removeHouseholdData(hid);

            let active = memberships.find(m => m.household.id === db.householdId);
            if (!active && memberships.length) {
                // Removed from the active household: switch to another one.
                await db.removeHouseholdData(db.householdId);
                active = memberships.find(m => m.role === 'owner') ?? memberships[0];
                await db.setMeta(META.activeHouseholdId, active.household.id);
                db.setHousehold(active.household.id, user.id);
                syncController.start(user.id, active.household.id, () => void get().refreshHousehold());
            }

            const [{ data: members }, { data: sub }] = await Promise.all([
                supabase.rpc('household_members_view', { p_household_id: db.householdId }),
                supabase.from('subscriptions').select('is_pro, expires_at').eq('user_id', user.id).maybeSingle(),
            ]);
            set({
                memberships,
                role: active?.role ?? 'owner',
                householdName: active?.household.name ?? 'My Household',
                members: (members ?? []).map((m: any) => ({
                    householdId: db.householdId,
                    userId: m.user_id,
                    role: m.role,
                    email: m.email,
                    displayName: m.display_name,
                    joinedAt: m.joined_at,
                })),
                accountPro: Boolean(sub?.is_pro && (!sub.expires_at || Date.parse(sub.expires_at) > Date.now())),
            });
        },

        switchHousehold: async householdId => {
            const { user } = get();
            if (!user) return;
            const db = getDb();
            await db.setMeta(META.activeHouseholdId, householdId);
            db.setHousehold(householdId, user.id);
            syncController.start(user.id, householdId, () => void get().refreshHousehold());
            await get().refreshHousehold();
        },

        renameHousehold: async name => {
            const { error } = await requireClient().from('households').update({ name }).eq('id', getDb().householdId);
            if (error) throw error;
            await get().refreshHousehold();
        },

        createInvite: async role => {
            const { data, error } = await requireClient().rpc('create_invite', { p_household_id: getDb().householdId, p_role: role });
            if (error) throw rpcError(error);
            const row = Array.isArray(data) ? data[0] : data;
            return { code: row.code, householdId: getDb().householdId, role, expiresAt: row.expires_at, maxUses: 5, useCount: 0 };
        },

        joinHousehold: async code => {
            const { data: hid, error } = await requireClient().rpc('accept_invite', { p_code: code });
            if (error) throw rpcError(error);
            // Rows of the new household predate our pull cursors: pull everything again.
            await syncController.engine?.resetCursors();
            await get().switchHousehold(hid as string);
        },

        setMemberRole: async (userId, role) => {
            const { error } = await requireClient()
                .from('household_members')
                .update({ role })
                .eq('household_id', getDb().householdId)
                .eq('user_id', userId);
            if (error) throw error;
            await get().refreshHousehold();
        },

        removeMember: async userId => {
            const { error } = await requireClient()
                .from('household_members')
                .delete()
                .eq('household_id', getDb().householdId)
                .eq('user_id', userId);
            if (error) throw error;
            await get().refreshHousehold();
        },

        leaveHousehold: async () => {
            const { user } = get();
            if (!user) return;
            const db = getDb();
            const leaving = db.householdId;
            const { error } = await requireClient().from('household_members').delete().eq('household_id', leaving).eq('user_id', user.id);
            if (error) throw error;
            const { data: hid, error: e2 } = await requireClient().rpc('bootstrap_household', { p_household_id: null });
            if (e2) throw e2;
            await get().switchHousehold(hid as string);
            await db.removeHouseholdData(leaving);
        },

        setStorePro: pro => set({ storePro: pro }),
    };
});
