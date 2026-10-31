import { findPantryMatch, itemKey, pantryCoverage } from './pantry';
import { Category, ListItem, PantryItem, Recipe } from './types';
import { convert, roundQuantity } from './units';

export type NeedStatus = 'needed' | 'partial' | 'in-pantry' | 'on-list';

export interface NeededIngredient {
    key: string;
    name: string;
    category: Category;
    quantity: number | null;
    unit: string | null;
    /** Quantity the recipe(s) call for before subtracting the pantry. */
    requiredQuantity: number | null;
    sources: string[]; // recipe titles
    recipeIds: string[];
    status: NeedStatus;
}

export interface PlannedRecipe {
    recipe: Recipe;
    servings: number | null;
}

interface Bucket {
    key: string;
    name: string;
    category: Category;
    quantity: number | null;
    unit: string | null;
    sources: Set<string>;
    recipeIds: Set<string>;
}

/**
 * Merge every ingredient of the planned recipes into one shopping list,
 * scaling by servings and combining compatible units ("1 cup milk" +
 * "250 ml milk"). Then mark lines the pantry or the current list already covers.
 */
export function consolidateIngredients(
    planned: PlannedRecipe[],
    pantry: PantryItem[] = [],
    listItems: ListItem[] = [],
): NeededIngredient[] {
    const buckets: Bucket[] = [];

    for (const { recipe, servings } of planned) {
        const base = recipe.servings > 0 ? recipe.servings : 1;
        const scale = servings && servings > 0 ? servings / base : 1;
        for (const ing of recipe.ingredients) {
            if (!ing.name.trim()) continue;
            const key = itemKey(ing.name);
            const qty = ing.quantity == null ? null : ing.quantity * scale;
            let bucket = buckets.find(
                b => b.key === key && (qty == null || b.quantity == null || convert(1, ing.unit, b.unit) !== null),
            );
            if (!bucket) {
                bucket = {
                    key,
                    name: ing.name.trim(),
                    category: ing.category,
                    quantity: qty,
                    unit: ing.unit,
                    sources: new Set(),
                    recipeIds: new Set(),
                };
                buckets.push(bucket);
            } else if (qty != null) {
                if (bucket.quantity == null) {
                    bucket.quantity = qty;
                    bucket.unit = ing.unit;
                } else {
                    bucket.quantity += convert(qty, ing.unit, bucket.unit) ?? 0;
                }
            }
            bucket.sources.add(recipe.title);
            bucket.recipeIds.add(recipe.id);
        }
    }

    const openListKeys = new Set(listItems.filter(i => !i.deletedAt && !i.isChecked).map(i => itemKey(i.name)));

    return buckets.map(b => {
        const required = b.quantity == null ? null : roundQuantity(b.quantity);
        let status: NeedStatus = 'needed';
        let remaining = required;

        if (openListKeys.has(b.key)) {
            status = 'on-list';
        } else {
            const match = findPantryMatch(pantry, b.name);
            const covered = pantryCoverage(match, required, b.unit);
            if (covered > 0) {
                if (required == null || covered >= required) {
                    status = 'in-pantry';
                    remaining = 0;
                } else {
                    status = 'partial';
                    remaining = roundQuantity(required - covered);
                }
            }
        }

        return {
            key: b.key,
            name: b.name,
            category: b.category,
            quantity: status === 'needed' ? required : remaining,
            unit: b.unit,
            requiredQuantity: required,
            sources: [...b.sources],
            recipeIds: [...b.recipeIds],
            status,
        };
    });
}

/** Lines that should be added to a list by default. */
export function itemsToBuy(lines: NeededIngredient[]): NeededIngredient[] {
    return lines.filter(l => l.status === 'needed' || l.status === 'partial');
}
