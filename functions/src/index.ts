import { initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore';
import { defineSecret, defineString } from 'firebase-functions/params';
import { logger } from 'firebase-functions/v2';
import { HttpsError, onCall, onRequest } from 'firebase-functions/v2/https';
import { deleteAccountData, isRecentLogin } from './deleteAccount';
import { planUpdates, RevenueCatEvent, secretMatches, SubscriptionUpdate } from './revenuecat';

initializeApp();
const db = getFirestore();

/** Shared secret RevenueCat sends as "Authorization: Bearer <secret>". */
const WEBHOOK_SECRET = defineSecret('REVENUECAT_WEBHOOK_SECRET');
/** RevenueCat entitlement identifier that means "Pro" (matches the app's EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID). */
const ENTITLEMENT = defineString('REVENUECAT_ENTITLEMENT_ID', { default: 'pro' });

/**
 * Records Pro status at subscriptions/{uid} and mirrors it onto the user's
 * own households (ownerPro), which lifts the member limit in the security
 * rules. Clients can never write either; only this function can.
 */
async function apply(update: SubscriptionUpdate, event: RevenueCatEvent): Promise<boolean> {
    const ref = db.doc(`subscriptions/${update.uid}`);
    const applied = await db.runTransaction(async tx => {
        const current = await tx.get(ref);
        // RevenueCat retries and may deliver out of order: never let an older event win.
        const lastAt = current.get('lastEventAt') as Timestamp | undefined;
        if (lastAt && lastAt.toMillis() > event.event_timestamp_ms) return false;
        tx.set(ref, {
            isPro: update.isPro,
            expiresAt: update.expiresAtMs == null ? null : Timestamp.fromMillis(update.expiresAtMs),
            productId: update.productId,
            lastEventId: event.id,
            lastEventType: event.type,
            lastEventAt: Timestamp.fromMillis(event.event_timestamp_ms),
            environment: event.environment ?? null,
            updatedAt: FieldValue.serverTimestamp(),
        });
        return true;
    });
    if (!applied) return false;

    const owned = await db.collection('households').where('ownerId', '==', update.uid).get();
    const batch = db.batch();
    owned.docs.forEach(h => batch.update(h.ref, { ownerPro: update.isPro }));
    await batch.commit();
    return true;
}

export const revenuecatWebhook = onRequest({ region: 'europe-west1', secrets: [WEBHOOK_SECRET], maxInstances: 5 }, async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).send('Use POST');
        return;
    }
    if (!secretMatches(req.get('authorization'), WEBHOOK_SECRET.value())) {
        res.status(401).send('Unauthorized');
        return;
    }
    const event = (req.body as { event?: RevenueCatEvent } | undefined)?.event;
    if (!event || typeof event.type !== 'string' || typeof event.event_timestamp_ms !== 'number') {
        res.status(400).send('Missing event');
        return;
    }

    const updates = planUpdates(event, ENTITLEMENT.value(), Date.now());
    try {
        const results = await Promise.all(updates.map(u => apply(u, event)));
        logger.info('RevenueCat event processed', { id: event.id, type: event.type, users: updates.length, applied: results.filter(Boolean).length });
        res.status(200).json({ ok: true, updated: results.filter(Boolean).length });
    } catch (e) {
        // 5xx makes RevenueCat retry later.
        logger.error('RevenueCat event failed', { id: event.id, error: (e as Error).message });
        res.status(500).send('Temporary failure');
    }
});

/**
 * In-app account deletion (required by Google Play and the App Store).
 * The app re-authenticates first; we only accept a sign-in from the last
 * few minutes so a stolen, long-lived session can't wipe an account.
 */
export const deleteAccount = onCall({ region: 'europe-west1', maxInstances: 5 }, async request => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Sign in to delete your account.');
    if (!isRecentLogin(request.auth?.token.auth_time, Date.now())) {
        throw new HttpsError('failed-precondition', 'Please enter your password again to confirm.');
    }
    try {
        const summary = await deleteAccountData(db, uid);
        logger.info('Account deleted', { uid, ...summary });
        return { ok: true, ...summary };
    } catch (e) {
        logger.error('Account deletion failed', { uid, error: (e as Error).message });
        throw new HttpsError('internal', 'Your account could not be deleted. Please try again.');
    }
});
