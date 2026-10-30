import { getLocales } from 'expo-localization';

/**
 * The currency of the user's region, from the phone's language & region
 * settings (e.g. NGN in Nigeria, GBP in the UK, EUR in Germany). Prices and
 * budgets always use it; it isn't a user setting.
 */
export function deviceCurrency(): string {
    try {
        for (const locale of getLocales()) {
            if (locale.currencyCode && /^[A-Z]{3}$/.test(locale.currencyCode)) return locale.currencyCode;
        }
    } catch {
        // Fall through to the default.
    }
    return 'USD';
}

/** Region code (e.g. "NG") for display, when the phone reports one. */
export function deviceRegion(): string | null {
    try {
        return getLocales()[0]?.regionCode ?? null;
    } catch {
        return null;
    }
}
