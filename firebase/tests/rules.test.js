/**
 * Firestore security rules, run against the emulator:
 *   npm run test:rules
 */
const { readFileSync } = require('fs');
const path = require('path');
const { assertFails, assertSucceeds, initializeTestEnvironment } = require('@firebase/rules-unit-testing');
const {
    arrayRemove,
    arrayUnion,
    collection,
    collectionGroup,
    doc,
    getDoc,
    getDocs,
    increment,
    query,
    serverTimestamp,
    setDoc,
    setLogLevel,
    Timestamp,
    updateDoc,
    where,
    writeBatch,
} = require('firebase/firestore');

let env;

// Denied writes are the point of most tests; don't log each one as a warning.
setLogLevel('error');
// The first emulator round trip can take a few seconds.
jest.setTimeout(30000);

beforeAll(async () => {
    env = await initializeTestEnvironment({
        projectId: 'demo-grocerycompanion',
        firestore: { rules: readFileSync(path.join(__dirname, '../../firestore.rules'), 'utf8') },
    });
});

afterAll(() => env.cleanup());
beforeEach(() => env.clearFirestore());

const db = uid => env.authenticatedContext(uid, { email: `${uid}@example.com` }).firestore();
const anon = () => env.unauthenticatedContext().firestore();
/** Writes that bypass rules, e.g. what the RevenueCat webhook does with the Admin SDK. */
const asAdmin = fn => env.withSecurityRulesDisabled(ctx => fn(ctx.firestore()));

const minutes = n => Timestamp.fromMillis(Date.now() + n * 60_000);

/** What the app does on first sign-in: household + owner membership in one batch. */
async function bootstrap(store, uid, hid) {
    const batch = writeBatch(store);
    batch.set(doc(store, 'households', hid), { name: 'Home', ownerId: uid, memberIds: [uid], ownerPro: false, createdAt: serverTimestamp() });
    batch.set(doc(store, 'households', hid, 'members', uid), { userId: uid, role: 'owner', email: `${uid}@example.com`, displayName: null, joinedAt: serverTimestamp() });
    return batch.commit();
}

function invite(code, hid, role = 'editor', extra = {}) {
    return { householdId: hid, role, createdBy: 'alice', createdAt: serverTimestamp(), expiresAt: minutes(7 * 24 * 60), maxUses: 5, useCount: 0, revoked: false, ...extra };
}

/** What the app does to accept an invite. */
function join(store, uid, hid, code, role) {
    const batch = writeBatch(store);
    batch.set(doc(store, 'households', hid, 'members', uid), { userId: uid, role, email: `${uid}@example.com`, displayName: null, joinedAt: serverTimestamp(), inviteCode: code });
    batch.update(doc(store, 'households', hid), { memberIds: arrayUnion(uid) });
    batch.update(doc(store, 'invites', code), { useCount: increment(1) });
    return batch.commit();
}

function row(hid, id, extra = {}) {
    return {
        id,
        household_id: hid,
        name: 'Weekly shop',
        updated_at: Timestamp.now(),
        server_updated_at: serverTimestamp(),
        deleted_at: null,
        ...extra,
    };
}

async function aliceWithHousehold() {
    await bootstrap(db('alice'), 'alice', 'h1');
    await setDoc(doc(db('alice'), 'invites', 'EDITCODE01'), invite('EDITCODE01', 'h1', 'editor'));
    await setDoc(doc(db('alice'), 'invites', 'VIEWCODE01'), invite('VIEWCODE01', 'h1', 'viewer'));
}

describe('households', () => {
    test('bootstrap creates the household with an owner membership', async () => {
        await assertSucceeds(bootstrap(db('alice'), 'alice', 'h1'));
        await assertSucceeds(getDoc(doc(db('alice'), 'households', 'h1')));
    });

    test("can't adopt an id that already exists", async () => {
        await bootstrap(db('alice'), 'alice', 'h1');
        await assertFails(bootstrap(db('mallory'), 'mallory', 'h1'));
    });

    test("can't create a household for someone else or without the owner membership", async () => {
        await assertFails(setDoc(doc(db('mallory'), 'households', 'h2'), { name: 'X', ownerId: 'alice', memberIds: ['alice'], ownerPro: false, createdAt: serverTimestamp() }));
        await assertFails(setDoc(doc(db('mallory'), 'households', 'h2'), { name: 'X', ownerId: 'mallory', memberIds: ['mallory'], ownerPro: false, createdAt: serverTimestamp() }));
    });

    test("can't create a household that is already Pro", async () => {
        const store = db('mallory');
        const batch = writeBatch(store);
        batch.set(doc(store, 'households', 'h2'), { name: 'X', ownerId: 'mallory', memberIds: ['mallory'], ownerPro: true, createdAt: serverTimestamp() });
        batch.set(doc(store, 'households', 'h2', 'members', 'mallory'), { userId: 'mallory', role: 'owner', email: null, displayName: null, joinedAt: serverTimestamp() });
        await assertFails(batch.commit());
    });

    test('anonymous users can do nothing', async () => {
        await bootstrap(db('alice'), 'alice', 'h1');
        await assertFails(getDoc(doc(anon(), 'households', 'h1')));
        await assertFails(bootstrap(anon(), 'nobody', 'h3'));
        await assertFails(getDoc(doc(anon(), 'invites', 'EDITCODE01')));
    });

    test('only the owner renames, and only the name', async () => {
        await aliceWithHousehold();
        await join(db('bob'), 'bob', 'h1', 'EDITCODE01', 'editor');
        await assertSucceeds(updateDoc(doc(db('alice'), 'households', 'h1'), { name: 'The Flat' }));
        await assertFails(updateDoc(doc(db('bob'), 'households', 'h1'), { name: 'Bob rules' }));
        await assertFails(updateDoc(doc(db('alice'), 'households', 'h1'), { ownerPro: true }));
        await assertFails(updateDoc(doc(db('alice'), 'households', 'h1'), { name: '' }));
    });
});

describe('synced rows', () => {
    test('owner can write; strangers can neither read nor write', async () => {
        await aliceWithHousehold();
        await assertSucceeds(setDoc(doc(db('alice'), 'households/h1/lists/l1'), row('h1', 'l1')));
        await assertFails(getDoc(doc(db('mallory'), 'households/h1/lists/l1')));
        await assertFails(getDocs(collection(db('mallory'), 'households/h1/lists')));
        await assertFails(setDoc(doc(db('mallory'), 'households/h1/lists/l2'), row('h1', 'l2')));
    });

    test('rows must match their path and household', async () => {
        await aliceWithHousehold();
        await assertFails(setDoc(doc(db('alice'), 'households/h1/lists/l1'), row('h1', 'other-id')));
        await assertFails(setDoc(doc(db('alice'), 'households/h1/lists/l1'), row('h2', 'l1')));
        await assertFails(setDoc(doc(db('alice'), 'households/h1/members_x/l1'), row('h1', 'l1')));
    });

    test('server_updated_at must be the server time', async () => {
        await aliceWithHousehold();
        await assertFails(setDoc(doc(db('alice'), 'households/h1/lists/l1'), row('h1', 'l1', { server_updated_at: Timestamp.now() })));
    });

    test('last writer wins: stale updates are rejected, newer ones apply', async () => {
        await aliceWithHousehold();
        const store = db('alice');
        const newer = Timestamp.fromMillis(Date.now());
        const older = Timestamp.fromMillis(Date.now() - 60_000);
        await assertSucceeds(setDoc(doc(store, 'households/h1/lists/l1'), row('h1', 'l1', { updated_at: newer, name: 'new' })));
        await assertFails(setDoc(doc(store, 'households/h1/lists/l1'), row('h1', 'l1', { updated_at: older, name: 'old' })));
        await assertSucceeds(setDoc(doc(store, 'households/h1/lists/l1'), row('h1', 'l1', { updated_at: Timestamp.now(), name: 'newest' })));
    });

    test('client clocks far in the future are refused', async () => {
        await aliceWithHousehold();
        await assertFails(setDoc(doc(db('alice'), 'households/h1/lists/l1'), row('h1', 'l1', { updated_at: minutes(60) })));
    });

    test('rows are never hard-deleted', async () => {
        await aliceWithHousehold();
        await setDoc(doc(db('alice'), 'households/h1/lists/l1'), row('h1', 'l1'));
        const { deleteDoc } = require('firebase/firestore');
        await assertFails(deleteDoc(doc(db('alice'), 'households/h1/lists/l1')));
    });
});

describe('invites', () => {
    test('editor invite: the new member can read and write', async () => {
        await aliceWithHousehold();
        await assertSucceeds(join(db('bob'), 'bob', 'h1', 'EDITCODE01', 'editor'));
        await assertSucceeds(setDoc(doc(db('bob'), 'households/h1/items/i1'), row('h1', 'i1', { list_id: 'l1' })));
        await assertSucceeds(getDocs(collection(db('bob'), 'households/h1/members')));
    });

    test('viewer invite: can read but not write', async () => {
        await aliceWithHousehold();
        await setDoc(doc(db('alice'), 'households/h1/lists/l1'), row('h1', 'l1'));
        await assertSucceeds(join(db('vic'), 'vic', 'h1', 'VIEWCODE01', 'viewer'));
        await assertSucceeds(getDoc(doc(db('vic'), 'households/h1/lists/l1')));
        await assertFails(setDoc(doc(db('vic'), 'households/h1/lists/l2'), row('h1', 'l2')));
        await assertFails(setDoc(doc(db('vic'), 'invites', 'VICCODE001'), { ...invite('VICCODE001', 'h1'), createdBy: 'vic' }));
    });

    test("you can't claim a better role than the invite gives", async () => {
        await aliceWithHousehold();
        await assertFails(join(db('vic'), 'vic', 'h1', 'VIEWCODE01', 'editor'));
        await assertFails(join(db('vic'), 'vic', 'h1', 'VIEWCODE01', 'owner'));
    });

    test('clients cannot add themselves without an invite', async () => {
        await aliceWithHousehold();
        const store = db('mallory');
        const batch = writeBatch(store);
        batch.set(doc(store, 'households/h1/members/mallory'), { userId: 'mallory', role: 'editor', email: null, displayName: null, joinedAt: serverTimestamp() });
        batch.update(doc(store, 'households', 'h1'), { memberIds: arrayUnion('mallory') });
        await assertFails(batch.commit());
    });

    test('expired, revoked and used-up invites are rejected', async () => {
        await aliceWithHousehold();
        await asAdmin(async store => {
            await setDoc(doc(store, 'invites', 'EXPIRED001'), invite('EXPIRED001', 'h1', 'editor', { expiresAt: minutes(-1) }));
            await setDoc(doc(store, 'invites', 'REVOKED001'), invite('REVOKED001', 'h1', 'editor', { revoked: true }));
            await setDoc(doc(store, 'invites', 'USEDUP0001'), invite('USEDUP0001', 'h1', 'editor', { useCount: 5 }));
        });
        await assertFails(join(db('bob'), 'bob', 'h1', 'EXPIRED001', 'editor'));
        await assertFails(join(db('bob'), 'bob', 'h1', 'REVOKED001', 'editor'));
        await assertFails(join(db('bob'), 'bob', 'h1', 'USEDUP0001', 'editor'));
    });

    test('an invite for one household cannot open another', async () => {
        await aliceWithHousehold();
        await bootstrap(db('carol'), 'carol', 'h2');
        await assertFails(join(db('bob'), 'bob', 'h2', 'EDITCODE01', 'editor'));
    });

    test('invites must be well-formed and short-lived', async () => {
        await aliceWithHousehold();
        const store = db('alice');
        await assertFails(setDoc(doc(store, 'invites', 'lowercase1'), invite('lowercase1', 'h1')));
        await assertFails(setDoc(doc(store, 'invites', 'LONGLIVED1'), invite('LONGLIVED1', 'h1', 'editor', { expiresAt: minutes(30 * 24 * 60) })));
        await assertFails(setDoc(doc(store, 'invites', 'OWNERROLE1'), invite('OWNERROLE1', 'h1', 'owner')));
        await assertFails(setDoc(doc(store, 'invites', 'PRESPENT01'), invite('PRESPENT01', 'h1', 'editor', { useCount: 3 })));
        await assertFails(setDoc(doc(db('mallory'), 'invites', 'MALLORY001'), { ...invite('MALLORY001', 'h1'), createdBy: 'mallory' }));
    });

    test('codes can be looked up but not listed', async () => {
        await aliceWithHousehold();
        await assertSucceeds(getDoc(doc(db('bob'), 'invites', 'EDITCODE01')));
        await assertFails(getDocs(collection(db('bob'), 'invites')));
    });

    test('editors can revoke', async () => {
        await aliceWithHousehold();
        await assertSucceeds(updateDoc(doc(db('alice'), 'invites', 'EDITCODE01'), { revoked: true }));
        await assertFails(updateDoc(doc(db('mallory'), 'invites', 'VIEWCODE01'), { revoked: true }));
    });
});

describe('member limit and Pro', () => {
    test('free households are capped at 3 members; Pro (set by the webhook) lifts it', async () => {
        await aliceWithHousehold();
        await assertSucceeds(join(db('bob'), 'bob', 'h1', 'EDITCODE01', 'editor'));
        await assertSucceeds(join(db('carol'), 'carol', 'h1', 'EDITCODE01', 'editor'));
        await assertFails(join(db('dave'), 'dave', 'h1', 'EDITCODE01', 'editor'));
        await asAdmin(store => updateDoc(doc(store, 'households', 'h1'), { ownerPro: true }));
        await assertSucceeds(join(db('dave'), 'dave', 'h1', 'EDITCODE01', 'editor'));
    });

    test("users can't grant themselves Pro", async () => {
        await aliceWithHousehold();
        await assertFails(setDoc(doc(db('alice'), 'subscriptions', 'alice'), { isPro: true }));
        await assertFails(updateDoc(doc(db('alice'), 'households', 'h1'), { ownerPro: true }));
        await asAdmin(store => setDoc(doc(store, 'subscriptions', 'alice'), { isPro: true }));
        await assertSucceeds(getDoc(doc(db('alice'), 'subscriptions', 'alice')));
        await assertFails(getDoc(doc(db('bob'), 'subscriptions', 'alice')));
    });
});

describe('membership changes', () => {
    function leave(store, uid, hid, who = uid) {
        const batch = writeBatch(store);
        batch.delete(doc(store, 'households', hid, 'members', who));
        batch.update(doc(store, 'households', hid), { memberIds: arrayRemove(who), lastRemoved: who });
        return batch.commit();
    }

    test('members can leave', async () => {
        await aliceWithHousehold();
        await join(db('bob'), 'bob', 'h1', 'EDITCODE01', 'editor');
        await assertSucceeds(leave(db('bob'), 'bob', 'h1'));
        await assertFails(getDoc(doc(db('bob'), 'households', 'h1')));
    });

    test('the owner can remove members but not themselves', async () => {
        await aliceWithHousehold();
        await join(db('bob'), 'bob', 'h1', 'EDITCODE01', 'editor');
        await assertFails(leave(db('alice'), 'alice', 'h1'));
        await assertSucceeds(leave(db('alice'), 'alice', 'h1', 'bob'));
    });

    test('members cannot remove each other', async () => {
        await aliceWithHousehold();
        await join(db('bob'), 'bob', 'h1', 'EDITCODE01', 'editor');
        await join(db('carol'), 'carol', 'h1', 'EDITCODE01', 'editor');
        await assertFails(leave(db('bob'), 'bob', 'h1', 'carol'));
    });

    test('the owner changes roles; nobody else can', async () => {
        await aliceWithHousehold();
        await join(db('bob'), 'bob', 'h1', 'EDITCODE01', 'editor');
        await join(db('vic'), 'vic', 'h1', 'VIEWCODE01', 'viewer');
        await assertSucceeds(updateDoc(doc(db('alice'), 'households/h1/members/bob'), { role: 'viewer' }));
        await assertFails(updateDoc(doc(db('alice'), 'households/h1/members/bob'), { role: 'owner' }));
        await assertFails(updateDoc(doc(db('vic'), 'households/h1/members/vic'), { role: 'editor' }));
        await assertFails(updateDoc(doc(db('bob'), 'households/h1/members/vic'), { role: 'editor' }));
    });

    test('everyone finds their own memberships, and only theirs', async () => {
        await aliceWithHousehold();
        await join(db('bob'), 'bob', 'h1', 'EDITCODE01', 'editor');
        const mine = await assertSucceeds(getDocs(query(collectionGroup(db('bob'), 'members'), where('userId', '==', 'bob'))));
        expect(mine.docs.map(d => d.ref.path)).toEqual(['households/h1/members/bob']);
        await assertFails(getDocs(query(collectionGroup(db('bob'), 'members'), where('userId', '==', 'alice'))));
    });
});

describe('user preferences', () => {
    test('users read and write only their own preferences', async () => {
        const prefs = { householdSize: 2, dietaryPreferences: ['vegan'], monthlyBudget: 300, currency: 'EUR', updatedAt: serverTimestamp() };
        await assertSucceeds(setDoc(doc(db('alice'), 'users', 'alice'), prefs));
        await assertFails(getDoc(doc(db('bob'), 'users', 'alice')));
        await assertFails(setDoc(doc(db('bob'), 'users', 'alice'), prefs));
        await assertFails(setDoc(doc(db('alice'), 'users', 'alice'), { ...prefs, isPro: true }));
    });
});
