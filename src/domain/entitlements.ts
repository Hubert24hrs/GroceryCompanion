// Every monetization decision lives here: the entitlement, free limits, which
// features need Pro, and where delivery is offered. The UI gates on these; the
// server independently enforces what it can, and keeps its own copy because it
// deploys separately:
//   firestore.rules          FREE_LIMITS.householdMembers, OWNER_PRO_UNLOCKS_HOUSEHOLD
//   functions/src/delivery.ts DELIVERY_COUNTRIES, FEATURE_ACCESS.delivery (a test compares them)

/** RevenueCat entitlement that means "Pro". */
export const ENTITLEMENT_ID = process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID || 'pro';

export const FREE_LIMITS = {
    activeLists: 2,
    householdMembers: 2,
    recipes: 10,
} as const;

/** List prices in USD. The stores show each country's local price for the same products. */
export const PRO_PRICES = {
    monthly: { amount: 5.99, label: '$5.99' },
    annual: { amount: 60, label: '$60' },
} as const;

/** "Save 17%" on the yearly plan versus paying monthly for a year. */
export const ANNUAL_SAVING = Math.round((1 - PRO_PRICES.annual.amount / (PRO_PRICES.monthly.amount * 12)) * 100);

export type ProFeature =
    | 'unlimitedLists'
    | 'unlimitedMembers'
    | 'unlimitedRecipes'
    | 'listTemplates'
    | 'mealPlanner'
    | 'smartSuggestions'
    | 'pantryAlerts'
    | 'barcodeScanner'
    | 'voiceAdd'
    | 'fullAnalytics'
    | 'priceInsights'
    | 'liveSync'
    | 'recipeToList'
    | 'delivery';

/** A household owner on Pro unlocks live sync for everyone in the household. */
export const OWNER_PRO_UNLOCKS_HOUSEHOLD = true;

/** Set a feature to 'free' to open it to everyone. Anything not listed needs Pro. */
export const FEATURE_ACCESS: Partial<Record<ProFeature, 'free' | 'pro'>> = {
    liveSync: 'pro',
    recipeToList: 'free',
    pantryAlerts: 'pro',
    delivery: 'pro',
};

export const EXPIRY_ALERT_DEFAULT_DAYS = 2;
export const EXPIRY_ALERT_DAY_OPTIONS = [1, 2, 3, 5, 7];

/**
 * Sending a list to a delivery partner. 'off' hides it everywhere (Instacart
 * must approve the API key first), 'mock' fakes the partner for development,
 * 'live' calls the createDeliveryLink function.
 */
export type DeliveryMode = 'off' | 'mock' | 'live';
const mode = process.env.EXPO_PUBLIC_DELIVERY_MODE;
export const DELIVERY_MODE: DeliveryMode = mode === 'mock' || mode === 'live' ? mode : 'off';
export const DELIVERY_COUNTRIES = ['US', 'CA'];

/** What the free plan includes (shown on the Pro screen for comparison). */
export const FREE_FEATURES: string[] = [
    `${FREE_LIMITS.activeLists} shopping lists with quick add and aisle sorting`,
    'Pantry with quantities',
    `Up to ${FREE_LIMITS.recipes} saved recipes, with ingredients to your list in one tap`,
    'Share with 1 other person',
    "This month's spending total",
];

export const PRO_FEATURES: { feature: ProFeature; title: string; detail: string; icon: string }[] = [
    { feature: 'liveSync', title: 'Live family sync', detail: 'See the open list change as your household shops', icon: 'sync' },
    { feature: 'unlimitedLists', title: 'Unlimited lists', detail: `Free includes ${FREE_LIMITS.activeLists} lists`, icon: 'list' },
    { feature: 'listTemplates', title: 'Reusable list templates', detail: 'Weekly staples in one tap', icon: 'copy' },
    { feature: 'mealPlanner', title: 'Meal planner', detail: 'Plan the week and get one shopping list', icon: 'calendar' },
    { feature: 'smartSuggestions', title: 'Smart meal ideas', detail: 'Ranked by pantry, expiry, diet and budget', icon: 'sparkles' },
    { feature: 'pantryAlerts', title: 'Expiry & low stock alerts', detail: 'Use food before it goes off, restock in one tap', icon: 'alarm' },
    { feature: 'barcodeScanner', title: 'Barcode scanning', detail: 'Scan products straight into your pantry', icon: 'barcode' },
    { feature: 'unlimitedRecipes', title: 'Unlimited recipe box', detail: `Free holds ${FREE_LIMITS.recipes} recipes`, icon: 'book' },
    { feature: 'unlimitedMembers', title: 'Bigger households', detail: `Share with more than ${FREE_LIMITS.householdMembers - 1} other person`, icon: 'people' },
    { feature: 'fullAnalytics', title: 'Full spending history', detail: 'Trends, aisles and savings insights', icon: 'stats-chart' },
    { feature: 'priceInsights', title: 'Price tracking', detail: 'See where each item was cheapest', icon: 'pricetags' },
    { feature: 'voiceAdd', title: 'Voice add', detail: 'Say your list instead of typing it', icon: 'mic' },
];

export function hasFeature(isPro: boolean, feature: ProFeature): boolean {
    return isPro || FEATURE_ACCESS[feature] === 'free';
}

/** Live sync is also unlocked by the household owner's Pro (ownerPro, set by the webhook). */
export function canLiveSync(isPro: boolean, ownerPro: boolean): boolean {
    return hasFeature(isPro, 'liveSync') || (OWNER_PRO_UNLOCKS_HOUSEHOLD && ownerPro);
}

export function canCreateList(isPro: boolean, activeListCount: number): boolean {
    return isPro || activeListCount < FREE_LIMITS.activeLists;
}

export function canAddRecipe(isPro: boolean, recipeCount: number): boolean {
    return isPro || recipeCount < FREE_LIMITS.recipes;
}

export function canAddMember(isPro: boolean, memberCount: number): boolean {
    return isPro || memberCount < FREE_LIMITS.householdMembers;
}
