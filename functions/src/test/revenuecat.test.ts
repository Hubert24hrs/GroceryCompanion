import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { isRecentLogin } from '../deleteAccount';
import { planUpdates, RevenueCatEvent, secretMatches } from '../revenuecat';

const NOW = Date.UTC(2026, 9, 29);
const DAY = 86_400_000;

const event = (type: string, extra: Partial<RevenueCatEvent> = {}): RevenueCatEvent => ({
    id: `evt-${type}`,
    type,
    app_user_id: 'uid-1',
    entitlement_ids: ['pro'],
    product_id: 'pro_monthly',
    expiration_at_ms: NOW + 30 * DAY,
    event_timestamp_ms: NOW,
    ...extra,
});

describe('planUpdates', () => {
    test('purchases and renewals grant Pro until expiry', () => {
        for (const type of ['INITIAL_PURCHASE', 'RENEWAL', 'UNCANCELLATION', 'PRODUCT_CHANGE']) {
            assert.deepEqual(planUpdates(event(type), 'pro', NOW), [{ uid: 'uid-1', isPro: true, expiresAtMs: NOW + 30 * DAY, productId: 'pro_monthly' }]);
        }
    });

    test('cancelling keeps Pro until the period ends', () => {
        assert.equal(planUpdates(event('CANCELLATION'), 'pro', NOW)[0].isPro, true);
        assert.equal(planUpdates(event('CANCELLATION', { expiration_at_ms: NOW - 1 }), 'pro', NOW)[0].isPro, false);
    });

    test('expiration removes Pro', () => {
        assert.equal(planUpdates(event('EXPIRATION'), 'pro', NOW)[0].isPro, false);
    });

    test('lifetime purchases (no expiry) stay Pro', () => {
        assert.equal(planUpdates(event('NON_RENEWING_PURCHASE', { expiration_at_ms: null }), 'pro', NOW)[0].isPro, true);
    });

    test('other entitlements, anonymous users and test events are ignored', () => {
        assert.deepEqual(planUpdates(event('INITIAL_PURCHASE', { entitlement_ids: ['other'] }), 'pro', NOW), []);
        assert.deepEqual(planUpdates(event('INITIAL_PURCHASE', { app_user_id: '$RCAnonymousID:abc' }), 'pro', NOW), []);
        assert.deepEqual(planUpdates(event('TEST'), 'pro', NOW), []);
        assert.deepEqual(planUpdates(event('SUBSCRIPTION_PAUSED'), 'pro', NOW), []);
    });

    test('the older single entitlement_id field is understood', () => {
        assert.equal(planUpdates(event('RENEWAL', { entitlement_ids: null, entitlement_id: 'pro' }), 'pro', NOW).length, 1);
    });

    test('transfers move Pro from one account to another', () => {
        const updates = planUpdates(event('TRANSFER', { app_user_id: undefined, transferred_from: ['old-uid'], transferred_to: ['new-uid'] }), 'pro', NOW);
        assert.deepEqual(
            updates.map(u => [u.uid, u.isPro]),
            [
                ['old-uid', false],
                ['new-uid', true],
            ],
        );
    });
});

describe('secretMatches', () => {
    test('accepts only the exact bearer secret', () => {
        assert.equal(secretMatches('Bearer s3cret', 's3cret'), true);
        assert.equal(secretMatches('Bearer s3creT', 's3cret'), false);
        assert.equal(secretMatches('s3cret', 's3cret'), false);
        assert.equal(secretMatches(undefined, 's3cret'), false);
        assert.equal(secretMatches('Bearer ', ''), false);
    });
});

describe('isRecentLogin', () => {
    test('accepts a sign-in from the last five minutes only', () => {
        const now = Date.UTC(2026, 9, 30, 12);
        assert.equal(isRecentLogin(now / 1000 - 60, now), true);
        assert.equal(isRecentLogin(now / 1000 - 6 * 60, now), false);
        assert.equal(isRecentLogin(undefined, now), false);
    });
});
