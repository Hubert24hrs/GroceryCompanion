import { initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore';
import { createHash } from 'node:crypto';
import { defineBoolean, defineSecret, defineString } from 'firebase-functions/params';
import { logger } from 'firebase-functions/v2';
import { HttpsError, onCall, onRequest } from 'firebase-functions/v2/https';
import { deleteAccountData, isRecentLogin } from './deleteAccount';
import {
    cachedLink,
    createShoppingLink,
    DELIVERY_REQUIRES_PRO,
    DeliveryRequest,
    hasNearbyRetailer,
    InstacartError,
    LINK_MS,
    LinkState,
    nextWindow,
    parseDeliveryRequest,
} from './delivery';
import { planUpdates, RevenueCatEvent, secretMatches, SubscriptionUpdate } from './revenuecat';

initializeApp();
const db = getFirestore();

/** Shared secret RevenueCat sends as "Authorization: Bearer <secret>". */
const WEBHOOK_SECRET = defineSecret('REVENUECAT_WEBHOOK_SECRET');
/** RevenueCat entitlement identifier that means "Pro" (matches the app's EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID). */
const ENTITLEMENT = defineString('REVENUECAT_ENTITLEMENT_ID', { default: 'pro' });
/** Instacart Developer Platform key, issued after Instacart approves the app. */
const INSTACART_KEY = defineSecret('INSTACART_API_KEY');
/** connect.dev.instacart.tools for a development key, connect.instacart.com for production. */
const INSTACART_URL = defineString('INSTACART_API_URL');
/** Off until Instacart has approved the integration (functions/.env). */
const DELIVERY_ENABLED = defineBoolean('DELIVERY_ENABLED', { default: false });

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

async function isSubscribed(uid: string): Promise<boolean> {
    const sub = await db.doc(`subscriptions/${uid}`).get();
    if (sub.get('isPro') !== true) return false;
    const expires = sub.get('expiresAt') as Timestamp | null | undefined;
    return !expires || expires.toMillis() > Date.now();
}

const hashRequest = ({ country, postalCode, items }: DeliveryRequest) => createHash('sha256').update(JSON.stringify([country, postalCode, items])).digest('hex');

/**
 * Turns a shopping list into an Instacart page and returns its URL. The API
 * key stays here; the app only ever sees the URL. deliveryLinks/{uid} holds
 * the last link (Instacart asks partners to reuse them) and the hourly count,
 * and no client can read it.
 */
export const createDeliveryLink = onCall({ region: 'europe-west1', secrets: [INSTACART_KEY], maxInstances: 5 }, async request => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Sign in to send your list.');
    if (!DELIVERY_ENABLED.value()) throw new HttpsError('failed-precondition', 'Delivery is not available yet.');

    let input: DeliveryRequest;
    try {
        input = parseDeliveryRequest(request.data);
    } catch (e) {
        throw new HttpsError('invalid-argument', (e as Error).message);
    }
    if (DELIVERY_REQUIRES_PRO && !(await isSubscribed(uid))) throw new HttpsError('permission-denied', 'Delivery is a Pro feature.');

    const hash = hashRequest(input);
    const ref = db.doc(`deliveryLinks/${uid}`);
    const now = Date.now();
    const cached = await db.runTransaction(async tx => {
        const state = (await tx.get(ref)).data() as LinkState | undefined;
        const url = cachedLink(state, hash, now);
        if (url) return url;
        const window = nextWindow(state, now);
        if (!window) throw new HttpsError('resource-exhausted', 'Too many lists sent. Try again in an hour.');
        tx.set(ref, window, { merge: true });
        return null;
    });
    if (cached) return { url: cached };

    try {
        const baseUrl = INSTACART_URL.value();
        const key = INSTACART_KEY.value();
        if (!(await hasNearbyRetailer(fetch, baseUrl, key, input.country, input.postalCode))) {
            throw new HttpsError('not-found', 'Instacart has no stores for that postal code yet.');
        }
        const url = await createShoppingLink(fetch, baseUrl, key, input.items);
        await ref.set({ hash, url, expiresAtMs: now + LINK_MS }, { merge: true });
        return { url };
    } catch (e) {
        if (e instanceof HttpsError) throw e;
        logger.error('Instacart request failed', { uid, status: e instanceof InstacartError ? e.status : null, error: (e as Error).message });
        throw new HttpsError('unavailable', "Instacart can't be reached right now. Please try again.");
    }
});
