import { getAuth } from 'firebase-admin/auth';
import { FieldValue, Firestore } from 'firebase-admin/firestore';

/** How recently the user must have signed in (re-entered their password) to delete the account. */
export const RECENT_LOGIN_SECONDS = 5 * 60;

export function isRecentLogin(authTimeSeconds: number | undefined, nowMs: number): boolean {
    return typeof authTimeSeconds === 'number' && nowMs / 1000 - authTimeSeconds <= RECENT_LOGIN_SECONDS;
}

export interface DeletionSummary {
    householdsDeleted: number;
    householdsLeft: number;
}

/**
 * Deletes everything an account owns, as the app stores require:
 * households it owns (with all their data and invites), its membership in
 * other households, its preferences and subscription record, and finally
 * the sign-in account itself. Other members keep their own data.
 */
export async function deleteAccountData(db: Firestore, uid: string): Promise<DeletionSummary> {
    const summary: DeletionSummary = { householdsDeleted: 0, householdsLeft: 0 };
    const memberships = await db.collectionGroup('members').where('userId', '==', uid).get();

    for (const member of memberships.docs) {
        const householdRef = member.ref.parent.parent;
        if (!householdRef) continue;
        const household = await householdRef.get();

        if (!household.exists || household.get('ownerId') === uid) {
            const invites = await db.collection('invites').where('householdId', '==', householdRef.id).get();
            const batch = db.batch();
            invites.docs.forEach(i => batch.delete(i.ref));
            await batch.commit();
            // Removes the household and every subcollection: members, lists, items, pantry, recipes, plans, purchases.
            await db.recursiveDelete(householdRef);
            summary.householdsDeleted++;
        } else {
            const batch = db.batch();
            batch.delete(member.ref);
            batch.update(householdRef, { memberIds: FieldValue.arrayRemove(uid), lastRemoved: uid });
            await batch.commit();
            summary.householdsLeft++;
        }
    }

    await db.recursiveDelete(db.doc(`users/${uid}`));
    await db.doc(`subscriptions/${uid}`).delete();
    await db.doc(`deliveryLinks/${uid}`).delete();
    await getAuth().deleteUser(uid);
    return summary;
}
