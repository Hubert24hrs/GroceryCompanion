import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
    cachedLink,
    createShoppingLink,
    hasNearbyRetailer,
    InstacartError,
    LINKS_PER_HOUR,
    MAX_ITEMS,
    nextWindow,
    parseDeliveryRequest,
    shoppingListBody,
} from '../delivery';

const NOW = Date.UTC(2026, 9, 31);
const items = [{ name: 'Milk', quantity: 2, unit: 'l' }];
const request = { country: 'US', postalCode: '94105', items };

describe('parseDeliveryRequest', () => {
    test('accepts US and Canadian requests', () => {
        assert.equal(parseDeliveryRequest(request).postalCode, '94105');
        assert.equal(parseDeliveryRequest({ ...request, postalCode: '94105-1234' }).postalCode, '94105-1234');
        assert.equal(parseDeliveryRequest({ ...request, country: 'CA', postalCode: 'k1a 0b1' }).postalCode, 'K1A 0B1');
    });

    test('rejects every other country, whatever the app says', () => {
        for (const country of ['NG', 'GB', 'DE', 'us', '', undefined]) {
            assert.throws(() => parseDeliveryRequest({ ...request, country }), /United States and Canada/);
        }
    });

    test('rejects a postal code from the wrong country', () => {
        assert.throws(() => parseDeliveryRequest({ ...request, postalCode: 'K1A 0B1' }), /ZIP code/);
        assert.throws(() => parseDeliveryRequest({ ...request, country: 'CA' }), /postal code/);
    });

    test('rejects empty, oversized and malformed lists', () => {
        assert.throws(() => parseDeliveryRequest({ ...request, items: [] }), /Add something/);
        assert.throws(() => parseDeliveryRequest({ ...request, items: Array(MAX_ITEMS + 1).fill(items[0]) }), /up to/);
        assert.throws(() => parseDeliveryRequest({ ...request, items: [{ name: '  ' }] }), /invalid name/);
        assert.throws(() => parseDeliveryRequest(null));
    });

    test('drops quantities that make no sense', () => {
        assert.equal(parseDeliveryRequest({ ...request, items: [{ name: 'Milk', quantity: -1 }] }).items[0].quantity, null);
    });
});

describe('shoppingListBody', () => {
    test('uses measurements, with only units Instacart supports', () => {
        const body = shoppingListBody([
            { name: 'Milk', quantity: 2, unit: 'l' },
            { name: 'Eggs', quantity: 12, unit: null },
            { name: 'Twine', quantity: 1, unit: 'roll' },
            { name: 'Salt', quantity: null, unit: null },
        ]);
        assert.deepEqual(body.line_items, [
            { name: 'Milk', line_item_measurements: [{ quantity: 2, unit: 'liter' }] },
            { name: 'Eggs', line_item_measurements: [{ quantity: 12, unit: 'each' }] },
            { name: 'Twine' },
            { name: 'Salt' },
        ]);
    });

    test('sends nothing about the user or their list name', () => {
        const body = shoppingListBody(items);
        assert.deepEqual(Object.keys(body).sort(), ['expires_in', 'line_items', 'link_type', 'title']);
        assert.equal(body.title, 'GroceryCompanion shopping list');
    });
});

describe('link cache and throttle', () => {
    test('reuses a link until the list changes or it expires', () => {
        const state = { hash: 'a', url: 'https://x', expiresAtMs: NOW + 1 };
        assert.equal(cachedLink(state, 'a', NOW), 'https://x');
        assert.equal(cachedLink(state, 'b', NOW), null);
        assert.equal(cachedLink(state, 'a', NOW + 1), null);
        assert.equal(cachedLink(undefined, 'a', NOW), null);
    });

    test('allows a set number of links per hour', () => {
        assert.deepEqual(nextWindow(undefined, NOW), { windowStartMs: NOW, count: 1 });
        assert.deepEqual(nextWindow({ windowStartMs: NOW, count: 3 }, NOW + 1), { windowStartMs: NOW, count: 4 });
        assert.equal(nextWindow({ windowStartMs: NOW, count: LINKS_PER_HOUR }, NOW + 1), null);
        assert.deepEqual(nextWindow({ windowStartMs: NOW, count: LINKS_PER_HOUR }, NOW + 3_600_000), { windowStartMs: NOW + 3_600_000, count: 1 });
    });
});

describe('Instacart calls', () => {
    const answer = (status: number, body: unknown) => (async () => new Response(JSON.stringify(body), { status })) as typeof fetch;

    test('create a link with the documented request', async () => {
        let url = '';
        let init: RequestInit | undefined;
        const http = (async (u: string, i: RequestInit) => {
            url = u;
            init = i;
            return new Response(JSON.stringify({ products_link_url: 'https://instacart.test/list' }));
        }) as typeof fetch;
        assert.equal(await createShoppingLink(http, 'https://host', 'key', items), 'https://instacart.test/list');
        assert.equal(url, 'https://host/idp/v1/products/products_link');
        assert.equal(init?.method, 'POST');
        assert.equal((init?.headers as Record<string, string>).Authorization, 'Bearer key');
    });

    test('surface failures', async () => {
        await assert.rejects(createShoppingLink(answer(500, {}), 'https://host', 'key', items), InstacartError);
        await assert.rejects(createShoppingLink(answer(200, {}), 'https://host', 'key', items), InstacartError);
    });

    test('look up retailers by postal code and country', async () => {
        let url = '';
        const http = (async (u: string) => {
            url = u;
            return new Response(JSON.stringify({ retailers: [{ retailer_key: 'r' }] }));
        }) as typeof fetch;
        assert.equal(await hasNearbyRetailer(http, 'https://host', 'key', 'CA', 'K1A 0B1'), true);
        assert.equal(url, 'https://host/idp/v1/retailers?postal_code=K1A+0B1&country_code=CA');
        assert.equal(await hasNearbyRetailer(answer(200, { retailers: [] }), 'https://host', 'key', 'US', '94105'), false);
    });

    test('a key without retailer access still sends the list', async () => {
        assert.equal(await hasNearbyRetailer(answer(403, {}), 'https://host', 'key', 'US', '94105'), true);
        await assert.rejects(hasNearbyRetailer(answer(500, {}), 'https://host', 'key', 'US', '94105'), InstacartError);
    });
});
