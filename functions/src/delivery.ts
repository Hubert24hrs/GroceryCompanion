// Sending a shopping list to Instacart, without Firebase so it can be tested
// alone. API reference: https://docs.instacart.com/developer_platform_api/
// Affiliate tracking needs nothing here: Instacart appends its parameters to
// the returned URL, and its docs warn that adding them by hand breaks attribution.

// Keep these two in step with src/domain/entitlements.ts (a test compares them).
export const DELIVERY_COUNTRIES = ['US', 'CA'];
export const DELIVERY_REQUIRES_PRO = true;

export const MAX_ITEMS = 200;
export const MAX_NAME_LENGTH = 120;
/** New links per user per hour. Reusing a cached link doesn't count. */
export const LINKS_PER_HOUR = 10;
const HOUR_MS = 3_600_000;
/** How long a link stays valid; Instacart asks partners to reuse links until the list changes. */
export const LINK_DAYS = 30;
export const LINK_MS = LINK_DAYS * 86_400_000;

const POSTAL_CODES: Record<string, RegExp> = {
    US: /^\d{5}(-\d{4})?$/,
    CA: /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/,
};

// The app's units, as Instacart spells them. Unsupported units make its quantity
// matching fail, so anything else goes without a measurement.
const INSTACART_UNITS: Record<string, string> = {
    pc: 'each',
    g: 'gram',
    kg: 'kilogram',
    oz: 'ounce',
    lb: 'pound',
    ml: 'milliliter',
    l: 'liter',
    tsp: 'teaspoon',
    tbsp: 'tablespoon',
    cup: 'cup',
    pt: 'pint',
    qt: 'quart',
    gal: 'gallon',
    can: 'can',
    pack: 'package',
    bunch: 'bunch',
};

export interface DeliveryItem {
    name: string;
    quantity: number | null;
    unit: string | null;
}

export interface DeliveryRequest {
    country: string;
    postalCode: string;
    items: DeliveryItem[];
}

export function isValidPostalCode(country: string, code: string): boolean {
    return POSTAL_CODES[country]?.test(code.trim()) ?? false;
}

/** Validates what the app sent. Throws with a message fit to show the user. */
export function parseDeliveryRequest(data: unknown): DeliveryRequest {
    const { country, postalCode, items } = (data ?? {}) as Record<string, unknown>;
    if (typeof country !== 'string' || !DELIVERY_COUNTRIES.includes(country)) {
        throw new Error('Delivery is only available in the United States and Canada.');
    }
    if (typeof postalCode !== 'string' || !isValidPostalCode(country, postalCode)) {
        throw new Error(country === 'US' ? 'Enter a valid ZIP code.' : 'Enter a valid postal code.');
    }
    if (!Array.isArray(items) || items.length === 0) throw new Error('Add something to the list first.');
    if (items.length > MAX_ITEMS) throw new Error(`Lists can send up to ${MAX_ITEMS} items.`);
    return {
        country,
        postalCode: postalCode.trim().toUpperCase(),
        items: items.map((raw: unknown) => {
            const { name, quantity, unit } = (raw ?? {}) as Record<string, unknown>;
            if (typeof name !== 'string' || !name.trim() || name.length > MAX_NAME_LENGTH) throw new Error('One of the items has an invalid name.');
            return {
                name: name.trim(),
                quantity: typeof quantity === 'number' && Number.isFinite(quantity) && quantity > 0 ? quantity : null,
                unit: typeof unit === 'string' ? unit : null,
            };
        }),
    };
}

/** Only the items: no list name, household or account details leave the app. */
export function shoppingListBody(items: DeliveryItem[]) {
    return {
        title: 'GroceryCompanion shopping list',
        link_type: 'shopping_list',
        expires_in: LINK_DAYS,
        line_items: items.map(({ name, quantity, unit }) => {
            const known = INSTACART_UNITS[unit ?? 'pc'];
            return quantity != null && known ? { name, line_item_measurements: [{ quantity, unit: known }] } : { name };
        }),
    };
}

export interface LinkState {
    hash?: string;
    url?: string;
    expiresAtMs?: number;
    windowStartMs?: number;
    count?: number;
}

export function cachedLink(state: LinkState | undefined, hash: string, nowMs: number): string | null {
    return state?.url && state.hash === hash && (state.expiresAtMs ?? 0) > nowMs ? state.url : null;
}

/** The next throttle window, or null when this user is over the limit. */
export function nextWindow(state: LinkState | undefined, nowMs: number): { windowStartMs: number; count: number } | null {
    const current = state?.windowStartMs != null && nowMs - state.windowStartMs < HOUR_MS;
    if (!current) return { windowStartMs: nowMs, count: 1 };
    const count = (state?.count ?? 0) + 1;
    return count > LINKS_PER_HOUR ? null : { windowStartMs: state?.windowStartMs as number, count };
}

export class InstacartError extends Error {
    constructor(readonly status: number) {
        super(`Instacart answered ${status}`);
    }
}

type Fetch = typeof fetch;

const headers = (apiKey: string) => ({ Accept: 'application/json', Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' });

/**
 * Whether any retailer serves this postal code. New keys may only reach the
 * shopping list endpoint, so a refused lookup doesn't stop the list being sent.
 */
export async function hasNearbyRetailer(http: Fetch, baseUrl: string, apiKey: string, country: string, postalCode: string): Promise<boolean> {
    const query = new URLSearchParams({ postal_code: postalCode, country_code: country });
    const res = await http(`${baseUrl}/idp/v1/retailers?${query}`, { headers: headers(apiKey), signal: AbortSignal.timeout(10_000) });
    if (res.status === 401 || res.status === 403) return true;
    if (!res.ok) throw new InstacartError(res.status);
    const body = (await res.json()) as { retailers?: unknown[] };
    return (body.retailers?.length ?? 0) > 0;
}

export async function createShoppingLink(http: Fetch, baseUrl: string, apiKey: string, items: DeliveryItem[]): Promise<string> {
    const res = await http(`${baseUrl}/idp/v1/products/products_link`, {
        method: 'POST',
        headers: headers(apiKey),
        body: JSON.stringify(shoppingListBody(items)),
        signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new InstacartError(res.status);
    const { products_link_url: url } = (await res.json()) as { products_link_url?: string };
    if (!url) throw new InstacartError(res.status);
    return url;
}
