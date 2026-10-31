// Turns RevenueCat webhook events into per-user Pro status. Pure functions so
// they can be tested without Firestore. Event reference:
// https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields

export interface RevenueCatEvent {
    id: string;
    type: string;
    app_user_id?: string;
    original_app_user_id?: string;
    aliases?: string[];
    entitlement_id?: string | null;
    entitlement_ids?: string[] | null;
    product_id?: string | null;
    expiration_at_ms?: number | null;
    event_timestamp_ms: number;
    transferred_from?: string[];
    transferred_to?: string[];
    environment?: 'SANDBOX' | 'PRODUCTION';
}

export interface SubscriptionUpdate {
    /** Firebase uid (the app logs RevenueCat in with it). */
    uid: string;
    isPro: boolean;
    expiresAtMs: number | null;
    productId: string | null;
}

// Events after which the entitlement is (still) active until expiration_at_ms.
// CANCELLATION only turns auto-renew off; access lasts until expiry.
const ACTIVE_EVENTS = new Set([
    'INITIAL_PURCHASE',
    'RENEWAL',
    'PRODUCT_CHANGE',
    'UNCANCELLATION',
    'NON_RENEWING_PURCHASE',
    'SUBSCRIPTION_EXTENDED',
    'TEMPORARY_ENTITLEMENT_GRANT',
    'CANCELLATION',
    'BILLING_ISSUE',
]);

/** RevenueCat ids for users who never signed in can't be matched to an account. */
const isAccountId = (id: string | undefined): id is string => !!id && !id.startsWith('$RCAnonymousID:');

function grantsEntitlement(event: RevenueCatEvent, entitlement: string): boolean {
    const ids = event.entitlement_ids ?? (event.entitlement_id ? [event.entitlement_id] : []);
    return ids.includes(entitlement);
}

/** Which users' Pro status this event changes, and to what. */
export function planUpdates(event: RevenueCatEvent, entitlement: string, nowMs: number): SubscriptionUpdate[] {
    if (event.type === 'TEST') return [];

    if (event.type === 'TRANSFER') {
        // Purchases moved between app users (e.g. restored on another account).
        const expiresAtMs = event.expiration_at_ms ?? null;
        return [
            ...(event.transferred_from ?? []).filter(isAccountId).map(uid => ({ uid, isPro: false, expiresAtMs: null, productId: null })),
            ...(event.transferred_to ?? [])
                .filter(isAccountId)
                .map(uid => ({ uid, isPro: expiresAtMs == null || expiresAtMs > nowMs, expiresAtMs, productId: event.product_id ?? null })),
        ];
    }

    if (!isAccountId(event.app_user_id) || !grantsEntitlement(event, entitlement)) return [];
    const expiresAtMs = event.expiration_at_ms ?? null;
    const productId = event.product_id ?? null;

    if (event.type === 'EXPIRATION') return [{ uid: event.app_user_id, isPro: false, expiresAtMs, productId }];
    if (ACTIVE_EVENTS.has(event.type)) {
        return [{ uid: event.app_user_id, isPro: expiresAtMs == null || expiresAtMs > nowMs, expiresAtMs, productId }];
    }
    // SUBSCRIPTION_PAUSED, INVOICE_ISSUANCE, … don't change access.
    return [];
}

/** Constant-time comparison for the shared webhook secret. */
export function secretMatches(header: string | undefined, secret: string): boolean {
    const expected = `Bearer ${secret}`;
    if (!header || !secret || header.length !== expected.length) return false;
    let diff = 0;
    for (let i = 0; i < expected.length; i++) diff |= header.charCodeAt(i) ^ expected.charCodeAt(i);
    return diff === 0;
}
