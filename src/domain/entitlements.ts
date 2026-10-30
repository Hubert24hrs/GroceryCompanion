// Free vs Pro. The UI gates on these; the server independently enforces the
// household member limit in firestore.rules (keep FREE_LIMITS.householdMembers in sync).

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
    | 'priceInsights';

/** What the free plan includes (shown on the Pro screen for comparison). */
export const FREE_FEATURES: string[] = [
    `${FREE_LIMITS.activeLists} shopping lists with quick add and aisle sorting`,
    'Pantry with quantities',
    `Up to ${FREE_LIMITS.recipes} saved recipes`,
    'Share with 1 other person',
    "This month's spending total",
];

export const PRO_FEATURES: { feature: ProFeature; title: string; detail: string; icon: string }[] = [
    { feature: 'unlimitedLists', title: 'Unlimited lists', detail: `Free includes ${FREE_LIMITS.activeLists} lists`, icon: 'list' },
    { feature: 'listTemplates', title: 'Reusable list templates', detail: 'Weekly staples in one tap', icon: 'copy' },
    { feature: 'mealPlanner', title: 'Meal planner', detail: 'Plan the week and get one shopping list', icon: 'calendar' },
    { feature: 'smartSuggestions', title: 'Smart meal ideas', detail: 'Ranked by pantry, expiry, diet and budget', icon: 'sparkles' },
    { feature: 'pantryAlerts', title: 'Expiry & low-stock alerts', detail: 'Use food before it goes off, restock in one tap', icon: 'alarm' },
    { feature: 'barcodeScanner', title: 'Barcode scanning', detail: 'Scan products straight into your pantry', icon: 'barcode' },
    { feature: 'unlimitedRecipes', title: 'Unlimited recipe box', detail: `Free holds ${FREE_LIMITS.recipes} recipes`, icon: 'book' },
    { feature: 'unlimitedMembers', title: 'Bigger households', detail: `Share with more than ${FREE_LIMITS.householdMembers - 1} other person`, icon: 'people' },
    { feature: 'fullAnalytics', title: 'Full spending history', detail: 'Trends, aisles and savings insights', icon: 'stats-chart' },
    { feature: 'priceInsights', title: 'Price tracking', detail: 'See where each item was cheapest', icon: 'pricetags' },
    { feature: 'voiceAdd', title: 'Voice add', detail: 'Say your list instead of typing it', icon: 'mic' },
];

export function hasFeature(isPro: boolean, _feature: ProFeature): boolean {
    return isPro;
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
