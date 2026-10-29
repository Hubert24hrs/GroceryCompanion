import { consolidateIngredients, itemsToBuy, NeededIngredient } from '../../domain/aggregate';
import { autoCategorize } from '../../domain/categories';
import { parseItem } from '../../domain/parsing';
import { Ingredient, MealPlanEntry, MealType, Recipe } from '../../domain/types';
import { getDb, NewRecord } from '../db';
import { addItem } from './items';

export type RecipeInput = NewRecord<'recipes'>;

export function createRecipe(input: RecipeInput): Recipe {
    return getDb().insert('recipes', input);
}

export function updateRecipe(id: string, patch: Partial<Recipe>): void {
    getDb().update('recipes', id, patch);
}

export function deleteRecipe(id: string): Promise<void> {
    const db = getDb();
    return db.transaction(() => {
        // Planned meals keep their slot as a free-text entry.
        for (const m of db.list('meal_plan_entries')) {
            if (m.recipeId === id) db.update('meal_plan_entries', m.id, { recipeId: null, title: db.get('recipes', id)?.title ?? 'Meal' });
        }
        db.remove('recipes', id);
    });
}

export function toggleFavorite(id: string): void {
    const db = getDb();
    const r = db.get('recipes', id);
    if (r) db.update('recipes', id, { isFavorite: !r.isFavorite });
}

/** Turn "2 cups flour" lines into structured ingredients. */
export function parseIngredientLines(text: string): Ingredient[] {
    return text
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean)
        .map(line => {
            const p = parseItem(line);
            return {
                name: p.name || line,
                quantity: p.quantity,
                unit: p.unit,
                category: autoCategorize(p.name || line),
                note: p.notes,
            };
        });
}

export function ingredientsToLines(ingredients: Ingredient[]): string {
    return ingredients
        .map(i => [i.quantity ?? '', i.unit ?? '', i.name, i.note ? `(${i.note})` : ''].filter(Boolean).join(' '))
        .join('\n');
}

/** Preview what a recipe (or a set of planned meals) would add to a list. */
export function previewIngredients(planned: { recipe: Recipe; servings: number | null }[], listId: string | null): NeededIngredient[] {
    const db = getDb();
    const listItems = listId ? db.list('items').filter(i => i.listId === listId) : [];
    return consolidateIngredients(planned, db.list('pantry_items'), listItems);
}

/** Add selected ingredient lines to a list. */
export function addIngredientsToList(listId: string, lines: NeededIngredient[]): Promise<number> {
    const db = getDb();
    return db.transaction(() => {
        for (const line of lines) {
            addItem(listId, {
                name: line.name,
                quantity: line.quantity,
                unit: line.unit,
                category: line.category,
                notes: line.sources.length ? `For ${line.sources.join(', ')}` : null,
                recipeId: line.recipeIds.length === 1 ? line.recipeIds[0] : null,
            });
        }
        return lines.length;
    });
}

export function defaultLines(planned: { recipe: Recipe; servings: number | null }[], listId: string | null) {
    return itemsToBuy(previewIngredients(planned, listId));
}

// ───────────────────────── meal plan ─────────────────────────

export function planMeal(input: { date: string; mealType: MealType; recipeId?: string | null; title?: string | null; servings?: number | null }): MealPlanEntry {
    return getDb().insert('meal_plan_entries', {
        date: input.date,
        mealType: input.mealType,
        recipeId: input.recipeId ?? null,
        title: input.title ?? null,
        servings: input.servings ?? null,
    });
}

export function updateMeal(id: string, patch: Partial<MealPlanEntry>): void {
    getDb().update('meal_plan_entries', id, patch);
}

export function removeMeal(id: string): void {
    getDb().remove('meal_plan_entries', id);
}

/** Bring back a removed meal (undo). */
export function restoreMeal(id: string): void {
    getDb().update('meal_plan_entries', id, { deletedAt: null });
}

/** Planned recipes in a date range, ready for consolidateIngredients. */
export function plannedRecipes(entries: MealPlanEntry[]): { recipe: Recipe; servings: number | null }[] {
    const db = getDb();
    return entries
        .map(e => ({ recipe: e.recipeId ? db.get('recipes', e.recipeId) : undefined, servings: e.servings }))
        .filter((p): p is { recipe: Recipe; servings: number | null } => !!p.recipe && !p.recipe.deletedAt);
}
