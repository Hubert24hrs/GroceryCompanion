import {
    arrayRemove,
    arrayUnion,
    collection,
    collectionGroup,
    doc,
    Firestore,
    FirestoreError,
    getDoc,
    getDocFromServer,
    getDocs,
    getDocsFromServer,
    increment,
    query,
    serverTimestamp,
    setDoc,
    Timestamp,
    updateDoc,
    where,
    writeBatch,
} from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import { HouseholdMember, Invite, Role, UserPreferences } from '../domain/types';
import { firestore } from './firebase';

// Household management on Firestore. The security rules (firestore.rules)
// enforce every permission here; these helpers only shape the writes.

export interface Membership {
    household: { id: string; name: string; ownerId: string; ownerPro: boolean };
    role: Role;
}

export interface SignedInUser {
    id: string;
    email: string | null;
}

const INVITE_DAYS = 7;
const INVITE_MAX_USES = 5;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O or 1/I to misread

function db(): Firestore {
    if (!firestore) throw new Error('Accounts are not configured for this build.');
    return firestore;
}

const isDenied = (e: unknown) => (e as FirestoreError | undefined)?.code === 'permission-denied';

function toDate(value: unknown): string {
    return value instanceof Timestamp ? value.toDate().toISOString() : new Date().toISOString();
}

/**
 * Every household the user belongs to, owned ones first. Always asks the server:
 * on a weak connection getDocs answers from an empty cache, and callers treat
 * "no memberships" as "the household was deleted" and clear local data.
 */
export async function myMemberships(uid: string): Promise<Membership[]> {
    const snap = await getDocsFromServer(query(collectionGroup(db(), 'members'), where('userId', '==', uid)));
    const result: Membership[] = [];
    for (const m of snap.docs) {
        const householdRef = m.ref.parent.parent;
        if (!householdRef) continue;
        const h = await getDocFromServer(householdRef);
        if (!h.exists()) continue;
        result.push({
            role: m.get('role') as Role,
            household: { id: h.id, name: (h.get('name') as string) ?? 'Household', ownerId: h.get('ownerId') as string, ownerPro: h.get('ownerPro') === true },
        });
    }
    return result.sort((a, b) => Number(b.role === 'owner') - Number(a.role === 'owner'));
}

function createHousehold(user: SignedInUser, householdId: string, name: string): Promise<void> {
    const batch = writeBatch(db());
    batch.set(doc(db(), 'households', householdId), {
        name,
        ownerId: user.id,
        memberIds: [user.id],
        ownerPro: false,
        createdAt: serverTimestamp(),
    });
    batch.set(doc(db(), 'households', householdId, 'members', user.id), {
        userId: user.id,
        role: 'owner',
        email: user.email,
        displayName: null,
        joinedAt: serverTimestamp(),
    });
    return batch.commit();
}

/**
 * The household this account should use. An existing one wins; otherwise one
 * is created with `preferredId` (this device's offline household) so local
 * data uploads without renaming. Returns the household id.
 */
export async function bootstrapHousehold(user: SignedInUser, preferredId: string | null): Promise<string> {
    const memberships = await myMemberships(user.id);
    if (memberships.length) return memberships[0].household.id;
    const id = preferredId ?? uuidv4();
    try {
        await createHousehold(user, id, 'My Household');
        return id;
    } catch (e) {
        // That id is already taken (a household this account no longer belongs to): start a fresh one.
        if (!isDenied(e) || !preferredId) throw e;
        const fresh = uuidv4();
        await createHousehold(user, fresh, 'My Household');
        return fresh;
    }
}

export async function loadMembers(householdId: string): Promise<HouseholdMember[]> {
    const snap = await getDocs(collection(db(), 'households', householdId, 'members'));
    return snap.docs
        .map(d => ({
            householdId,
            userId: d.id,
            role: d.get('role') as Role,
            email: (d.get('email') as string | null) ?? null,
            displayName: (d.get('displayName') as string | null) ?? null,
            joinedAt: toDate(d.get('joinedAt')),
        }))
        .sort((a, b) => Number(b.role === 'owner') - Number(a.role === 'owner') || a.joinedAt.localeCompare(b.joinedAt));
}

/** Pro bought on any device, recorded by the RevenueCat webhook. */
export async function loadAccountPro(uid: string): Promise<boolean> {
    const snap = await getDoc(doc(db(), 'subscriptions', uid));
    if (!snap.exists() || snap.get('isPro') !== true) return false;
    const expires = snap.get('expiresAt');
    return !(expires instanceof Timestamp) || expires.toMillis() > Date.now();
}

export function renameHousehold(householdId: string, name: string): Promise<void> {
    return updateDoc(doc(db(), 'households', householdId), { name });
}

function randomCode(): string {
    const bytes = new Uint8Array(10);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, b => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}

export async function createInvite(householdId: string, uid: string, role: 'editor' | 'viewer'): Promise<Invite> {
    const expiresAt = new Date(Date.now() + INVITE_DAYS * 86_400_000);
    for (let attempt = 0; attempt < 3; attempt++) {
        const code = randomCode();
        try {
            await setDoc(doc(db(), 'invites', code), {
                householdId,
                role,
                createdBy: uid,
                createdAt: serverTimestamp(),
                expiresAt: Timestamp.fromDate(expiresAt),
                maxUses: INVITE_MAX_USES,
                useCount: 0,
                revoked: false,
            });
            return { code, householdId, role, expiresAt: expiresAt.toISOString(), maxUses: INVITE_MAX_USES, useCount: 0 };
        } catch (e) {
            // A taken code looks like a denied update; anything else is real.
            if (!isDenied(e) || attempt === 2) {
                throw isDenied(e) ? new Error('Only owners and editors can invite people.') : e;
            }
        }
    }
    throw new Error('Could not create an invite. Try again.');
}

/** Join the household behind an invite code. Returns its id. */
export async function acceptInvite(code: string, user: SignedInUser): Promise<string> {
    const invalid = new Error('This invite code is invalid or has expired.');
    const snap = await getDoc(doc(db(), 'invites', code));
    if (!snap.exists()) throw invalid;
    const invite = snap.data();
    const expires = invite.expiresAt instanceof Timestamp ? invite.expiresAt.toMillis() : 0;
    if (invite.revoked || expires < Date.now() || invite.useCount >= invite.maxUses) throw invalid;

    const householdId = invite.householdId as string;
    const existing = await myMemberships(user.id);
    if (existing.some(m => m.household.id === householdId)) return householdId;

    const batch = writeBatch(db());
    batch.set(doc(db(), 'households', householdId, 'members', user.id), {
        userId: user.id,
        role: invite.role,
        email: user.email,
        displayName: null,
        joinedAt: serverTimestamp(),
        inviteCode: code,
    });
    batch.update(doc(db(), 'households', householdId), { memberIds: arrayUnion(user.id) });
    batch.update(doc(db(), 'invites', code), { useCount: increment(1) });
    try {
        await batch.commit();
    } catch (e) {
        // The invite checked out above, so a refusal now means the household is full.
        if (isDenied(e)) throw new Error('This household is full. The owner can upgrade to Pro to add more people.');
        throw e;
    }
    return householdId;
}

export function setMemberRole(householdId: string, userId: string, role: 'editor' | 'viewer'): Promise<void> {
    return updateDoc(doc(db(), 'households', householdId, 'members', userId), { role });
}

/** Remove someone (owner) or yourself (leave). */
export function removeMember(householdId: string, userId: string): Promise<void> {
    const batch = writeBatch(db());
    batch.delete(doc(db(), 'households', householdId, 'members', userId));
    batch.update(doc(db(), 'households', householdId), { memberIds: arrayRemove(userId), lastRemoved: userId });
    return batch.commit();
}

/** After leaving: the household the user owns, or a new one. */
export async function ownHousehold(user: SignedInUser): Promise<string> {
    const owned = (await myMemberships(user.id)).find(m => m.role === 'owner');
    if (owned) return owned.household.id;
    const id = uuidv4();
    await createHousehold(user, id, 'My Household');
    return id;
}

// ───────────────────────── preferences ─────────────────────────

type SyncedPrefs = Pick<UserPreferences, 'householdSize' | 'dietary' | 'monthlyBudget' | 'currency'>;

export async function loadProfile(uid: string): Promise<Partial<SyncedPrefs> | null> {
    const snap = await getDoc(doc(db(), 'users', uid));
    if (!snap.exists()) return null;
    const d = snap.data();
    return {
        householdSize: typeof d.householdSize === 'number' ? d.householdSize : undefined,
        dietary: Array.isArray(d.dietaryPreferences) ? d.dietaryPreferences : undefined,
        monthlyBudget: typeof d.monthlyBudget === 'number' ? d.monthlyBudget : d.monthlyBudget === null ? null : undefined,
        currency: typeof d.currency === 'string' ? d.currency : undefined,
    };
}

export function saveProfile(uid: string, prefs: SyncedPrefs): Promise<void> {
    return setDoc(
        doc(db(), 'users', uid),
        {
            householdSize: prefs.householdSize,
            dietaryPreferences: prefs.dietary,
            monthlyBudget: prefs.monthlyBudget,
            currency: prefs.currency,
            updatedAt: serverTimestamp(),
        },
        { merge: true },
    );
}
