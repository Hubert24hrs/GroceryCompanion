import { expiryStatus, findPantryMatch, itemKey, pantryCoverage } from './pantry';
import { Category, Ingredient, PantryItem, Recipe } from './types';

export interface SuggestionPrefs {
    dietary: string[];
    householdSize: number;
    monthlyBudget: number | null;
}

export interface MealSuggestion {
    recipe: Recipe;
    coverage: number; // 0..1 share of ingredients already in the pantry
    missing: Ingredient[];
    usesExpiring: string[];
    estimatedCost: number | null; // cost of the missing ingredients for the household
    fitsBudget: boolean | null;
    score: number;
    reasons: string[];
}

const ANIMAL: Category[] = ['meat', 'seafood'];
const DAIRY_WORDS = /\b(milk|cheese|butter|cream|yogurt|yoghurt|ghee|whey)\b/i;
const EGG_WORDS = /\beggs?\b/i;
const GLUTEN_WORDS = /\b(flour|bread|pasta|spaghetti|noodle|tortilla|couscous|barley|rye|cracker|crouton|bun|bagel|pita|naan|soy sauce)\b/i;

/** True when the recipe is compatible with every dietary preference. */
export function matchesDiet(recipe: Recipe, dietary: string[]): boolean {
    const tags = recipe.tags.map(t => t.toLowerCase());
    const ings = recipe.ingredients;
    for (const pref of dietary.map(d => d.toLowerCase())) {
        if (tags.includes(pref)) continue;
        switch (pref) {
            case 'vegetarian':
                if (ings.some(i => ANIMAL.includes(i.category))) return false;
                break;
            case 'pescatarian':
                if (ings.some(i => i.category === 'meat')) return false;
                break;
            case 'vegan':
                if (ings.some(i => ANIMAL.includes(i.category) || DAIRY_WORDS.test(i.name) || EGG_WORDS.test(i.name) || /honey/i.test(i.name)))
                    return false;
                break;
            case 'dairy-free':
                if (ings.some(i => DAIRY_WORDS.test(i.name) && !/coconut|almond|oat|soy/i.test(i.name))) return false;
                break;
            case 'gluten-free':
                if (ings.some(i => GLUTEN_WORDS.test(i.name) && !/gluten[- ]free/i.test(i.name))) return false;
                break;
            default:
                // Unknown preference: require the recipe to be tagged with it.
                return false;
        }
    }
    return true;
}

// Staples nobody wants suggested as "missing".
const STAPLES = new Set(['salt', 'black pepper', 'pepper', 'water', 'oil', 'olive oil', 'vegetable oil', 'cooking spray']);

/**
 * Rank recipes the household can cook soon: favour high pantry coverage,
 * ingredients about to expire, favourites and budget fit; skip recipes that
 * clash with dietary preferences or were planned recently.
 */
export function suggestMeals(
    recipes: Recipe[],
    pantry: PantryItem[],
    prefs: SuggestionPrefs,
    todayIso: string,
    options: { unitPrices?: Map<string, number>; recentlyPlanned?: Set<string>; limit?: number } = {},
): MealSuggestion[] {
    const { unitPrices = new Map(), recentlyPlanned = new Set(), limit = 10 } = options;
    const liveRecipes = recipes.filter(r => !r.deletedAt && r.ingredients.length > 0 && matchesDiet(r, prefs.dietary));
    const household = Math.max(1, prefs.householdSize);
    const perServingBudget = prefs.monthlyBudget ? prefs.monthlyBudget / (30 * 3 * household) : null;

    const results = liveRecipes.map(recipe => {
        const scale = household / Math.max(1, recipe.servings);
        const relevant = recipe.ingredients.filter(i => !STAPLES.has(itemKey(i.name)));
        const missing: Ingredient[] = [];
        const usesExpiring: string[] = [];
        let have = 0;

        for (const ing of relevant) {
            const match = findPantryMatch(pantry, ing.name);
            const needed = ing.quantity == null ? null : ing.quantity * scale;
            const covered = pantryCoverage(match, needed, ing.unit);
            if (match && covered > 0 && (needed == null || covered >= needed * 0.75)) {
                have++;
                const status = expiryStatus(match, todayIso);
                if (status === 'soon' || status === 'expired') usesExpiring.push(match.name);
            } else {
                missing.push(ing);
            }
        }

        const coverage = relevant.length ? have / relevant.length : 0;

        let estimatedCost: number | null = 0;
        for (const ing of missing) {
            const price = unitPrices.get(itemKey(ing.name));
            if (price == null) {
                estimatedCost = null;
                break;
            }
            estimatedCost += price;
        }
        if (estimatedCost === null && recipe.estimatedCost != null) {
            estimatedCost = recipe.estimatedCost * scale * (1 - coverage);
        }
        const perServing = estimatedCost == null ? null : estimatedCost / household;
        const fitsBudget = perServing == null || perServingBudget == null ? null : perServing <= perServingBudget;

        const reasons: string[] = [];
        if (coverage >= 0.999) reasons.push('Everything is in your pantry');
        else if (coverage >= 0.5) reasons.push(`${Math.round(coverage * 100)}% in your pantry`);
        if (usesExpiring.length) reasons.push(`Uses ${usesExpiring.slice(0, 2).join(' & ')} before it expires`);
        if (fitsBudget) reasons.push('Fits your budget');
        if (recipe.isFavorite) reasons.push('A favourite');

        const score =
            coverage * 60 +
            Math.min(usesExpiring.length, 3) * 12 +
            (recipe.isFavorite ? 8 : 0) +
            (fitsBudget === true ? 8 : fitsBudget === false ? -10 : 0) -
            (recentlyPlanned.has(recipe.id) ? 25 : 0);

        return { recipe, coverage, missing, usesExpiring, estimatedCost, fitsBudget, score, reasons };
    });

    return results.sort((a, b) => b.score - a.score || a.recipe.title.localeCompare(b.recipe.title)).slice(0, limit);
}
