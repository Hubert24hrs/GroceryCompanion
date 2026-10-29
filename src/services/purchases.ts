import { Platform } from 'react-native';
import Purchases, { CustomerInfo, PurchasesPackage } from 'react-native-purchases';

export interface PlanOption {
    id: string;
    title: string;
    priceString: string;
    period: 'monthly' | 'annual' | 'other';
}

export class PurchaseError extends Error {
    constructor(message: string, readonly cancelled = false) {
        super(message);
    }
}

const ENTITLEMENT = process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID || 'pro';
const rawKey = Platform.select({
    ios: process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_IOS,
    android: process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID,
});
// Template values like "appl_..." or "your-key" mean "not set up yet".
const apiKey = rawKey && !/\.\.\.|your[-_.]/i.test(rawKey) ? rawKey : undefined;

let configured = false;
let packages: PurchasesPackage[] = [];

const isPro = (info: CustomerInfo) => Boolean(info.entitlements.active[ENTITLEMENT]);

export const purchasesAvailable = Boolean(apiKey);
export const purchasesUnavailableReason = apiKey ? null : 'Subscriptions are not configured for this build.';

/** Configure RevenueCat and identify the user (Firebase uid) so entitlements follow the account. */
export async function configurePurchases(userId: string | null): Promise<boolean | null> {
    if (!apiKey) return null;
    try {
        if (!configured) {
            Purchases.configure({ apiKey, appUserID: userId ?? undefined });
            configured = true;
        } else if (userId) {
            await Purchases.logIn(userId);
        } else if (!(await Purchases.isAnonymous())) {
            await Purchases.logOut();
        }
        return isPro(await Purchases.getCustomerInfo());
    } catch (e) {
        console.warn('RevenueCat unavailable:', (e as Error).message);
        return null;
    }
}

export function onProStatusChange(listener: (pro: boolean) => void): () => void {
    if (!configured) return () => undefined;
    const handler = (info: CustomerInfo) => listener(isPro(info));
    Purchases.addCustomerInfoUpdateListener(handler);
    return () => Purchases.removeCustomerInfoUpdateListener(handler);
}

export async function getPlans(): Promise<PlanOption[]> {
    if (!configured) throw new PurchaseError(purchasesUnavailableReason ?? 'Store is not ready yet.');
    const offerings = await Purchases.getOfferings();
    packages = offerings.current?.availablePackages ?? [];
    return packages.map(p => ({
        id: p.identifier,
        title: p.product.title,
        priceString: p.product.priceString,
        period: p.packageType === 'MONTHLY' ? 'monthly' : p.packageType === 'ANNUAL' ? 'annual' : 'other',
    }));
}

export async function purchasePlan(id: string): Promise<boolean> {
    const pkg = packages.find(p => p.identifier === id);
    if (!pkg) throw new PurchaseError('That plan is no longer available. Please reopen this screen.');
    try {
        const { customerInfo } = await Purchases.purchasePackage(pkg);
        return isPro(customerInfo);
    } catch (e) {
        const err = e as { userCancelled?: boolean; message?: string };
        if (err.userCancelled) throw new PurchaseError('Purchase cancelled', true);
        throw new PurchaseError(err.message || 'The purchase could not be completed.');
    }
}

export async function restorePurchases(): Promise<boolean> {
    if (!configured) throw new PurchaseError(purchasesUnavailableReason ?? 'Store is not ready yet.');
    try {
        return isPro(await Purchases.restorePurchases());
    } catch (e) {
        throw new PurchaseError((e as Error).message || 'Restore failed. Check your connection and try again.');
    }
}

export function manageSubscriptionsUrl(): string {
    return Platform.OS === 'ios' ? 'https://apps.apple.com/account/subscriptions' : 'https://play.google.com/store/account/subscriptions';
}
