import { DeliveryMode } from './entitlements';
import { ListItem } from './types';

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

/** A partner that can turn a list into an order. */
export interface DeliveryProvider {
    id: string;
    /** Button text, in the wording the partner allows. */
    label: string;
    supportedCountries: string[];
    /** The partner's page for this list, to open in the browser. */
    buildShoppingLink(request: DeliveryRequest): Promise<string>;
}

const POSTAL_CODES: Record<string, RegExp> = {
    US: /^\d{5}(-\d{4})?$/,
    CA: /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/,
};

export function isValidPostalCode(country: string, code: string): boolean {
    return POSTAL_CODES[country]?.test(code.trim()) ?? false;
}

export const OTHER_COUNTRY = 'OTHER';

/** The user's choice in Settings, or the phone's region. */
export function resolveCountry(override: string | null, deviceRegion: string | null): string | null {
    return override ?? deviceRegion;
}

/** Null means no delivery UI at all: nothing is shown disabled. */
export function providerFor(providers: DeliveryProvider[], mode: DeliveryMode, country: string | null): DeliveryProvider | null {
    if (mode === 'off' || !country) return null;
    return providers.find(p => p.supportedCountries.includes(country)) ?? null;
}

/** What's still to buy, and only what the partner needs to find it. */
export function itemsForDelivery(items: ListItem[]): DeliveryItem[] {
    return items.filter(i => !i.deletedAt && !i.isChecked).map(({ name, quantity, unit }) => ({ name, quantity, unit }));
}
