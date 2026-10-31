// In-app purchases run through the App Store / Google Play. On the web, Pro
// status comes from the account (the RevenueCat webhook writes it server-side).

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

export const purchasesAvailable = false;
export const purchasesUnavailableReason = 'Subscribe from the Grocery Companion iOS or Android app. Your Pro status follows your account.';

export async function configurePurchases(_userId: string | null): Promise<boolean | null> {
    return null;
}

export function onProStatusChange(_listener: (pro: boolean) => void): () => void {
    return () => undefined;
}

export async function getPlans(): Promise<PlanOption[]> {
    throw new PurchaseError(purchasesUnavailableReason);
}

export async function purchasePlan(_id: string): Promise<boolean> {
    throw new PurchaseError(purchasesUnavailableReason);
}

export async function restorePurchases(): Promise<boolean> {
    throw new PurchaseError(purchasesUnavailableReason);
}

export function manageSubscriptionsUrl(): string {
    return 'https://apps.apple.com/account/subscriptions';
}
