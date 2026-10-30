import { autoCategorize, isCategory } from '../domain/categories';
import { isValidISODate } from '../domain/dates';
import { defaultPantryLocation, itemKey } from '../domain/pantry';
import { normalizeUnit } from '../domain/units';
import { Category } from '../domain/types';
import { LocalDatabase } from './db';
import { LegacyData } from './storage/types';

const str = (v: unknown): string | null => (typeof v === 'string' && v.length ? v : null);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const iso = (v: unknown, fallback: string): string => {
    const s = str(v);
    return s && !Number.isNaN(Date.parse(s)) ? new Date(s).toISOString() : fallback;
};
const category = (v: unknown, name: string): Category => (isCategory(v) ? v : autoCategorize(name));

export interface LegacyMealPlan {
    meals: { id?: string; date?: string; type?: string; recipeId?: string }[];
}

/**
 * Convert v1 data (SQLite lists/items/recent_items + the AsyncStorage meal
 * plan) into v2 records in the current household. v1 "pantry" items were list
 * items flagged is_in_pantry; those become pantry rows, and any price they
 * carried becomes a purchase so spending history survives.
 */
export function importLegacy(
    db: LocalDatabase,
    legacy: LegacyData | null,
    mealPlan: LegacyMealPlan | null,
    seedIds: Map<string, string>,
): Promise<{ lists: number; items: number; pantry: number; purchases: number; meals: number }> {
    const counts = { lists: 0, items: 0, pantry: 0, purchases: 0, meals: 0 };
    const now = new Date().toISOString();

    return db.transaction(() => {
        if (legacy) {
            const listIds = new Set<string>();
            legacy.lists.forEach((row, i) => {
                const id = str(row.id);
                const name = str(row.name);
                if (!id || !name) return;
                listIds.add(id);
                const list = db.insert('lists', {
                    id,
                    name,
                    color: str(row.color) ?? '#1F8A4C',
                    icon: 'cart',
                    storeName: str(row.store_name),
                    storeId: str(row.store_id),
                    budget: num(row.budget),
                    sortOrder: i,
                    isArchived: row.is_archived === 1 || row.is_archived === true,
                    isTemplate: false,
                    ownerId: db.actorId,
                });
                // Preserve original timestamps.
                db.applyRemote('lists', { ...list, createdAt: iso(row.created_at, now), updatedAt: iso(row.updated_at, now) });
                counts.lists++;
            });

            for (const row of legacy.items) {
                const id = str(row.id);
                const name = str(row.name);
                const listId = str(row.list_id);
                if (!id || !name || !listId || !listIds.has(listId)) continue;
                const cat = category(row.category, name);
                const qty = num(row.quantity);
                const unit = normalizeUnit(str(row.unit)) ?? str(row.unit);
                const updatedAt = iso(row.updated_at, now);

                if (row.is_in_pantry === 1 || row.is_in_pantry === true) {
                    db.insert('pantry_items', {
                        id,
                        name,
                        category: cat,
                        quantity: qty ?? 1,
                        unit,
                        lowStockThreshold: null,
                        expiresOn: null,
                        location: defaultPantryLocation(cat),
                        barcode: null,
                        notes: str(row.notes),
                    });
                    counts.pantry++;
                    const price = num(row.price);
                    if (price != null && price > 0) {
                        const p = db.insert('purchases', {
                            listId,
                            name,
                            category: cat,
                            quantity: qty,
                            unit,
                            price,
                            storeName: null,
                            purchasedAt: updatedAt,
                        });
                        db.applyRemote('purchases', { ...p, createdAt: updatedAt });
                        counts.purchases++;
                    }
                } else {
                    db.insert('items', {
                        id,
                        listId,
                        name,
                        category: cat,
                        quantity: qty,
                        unit,
                        notes: str(row.notes),
                        price: num(row.price),
                        isChecked: row.is_checked === 1 || row.is_checked === true,
                        checkedAt: null,
                        barcode: null,
                        recipeId: null,
                        addedBy: db.actorId,
                        checkedBy: null,
                    });
                    counts.items++;
                }
            }

            for (const row of legacy.recentItems) {
                const name = str(row.name);
                if (!name) continue;
                db.putLocal('recent_items', {
                    // Keyed like every other recent item, so v1 entries merge with new ones.
                    id: itemKey(name),
                    name,
                    category: category(row.category, name),
                    unit: null,
                    useCount: num(row.usage_count) ?? 1,
                    lastUsed: iso(row.last_used, now),
                });
            }
        }

        for (const meal of mealPlan?.meals ?? []) {
            const recipeId = meal.recipeId ? seedIds.get(meal.recipeId) : undefined;
            const type = meal.type;
            // v1 stored full ISO timestamps; the planner keys days as YYYY-MM-DD.
            const date = typeof meal.date === 'string' ? meal.date.slice(0, 10) : '';
            if (!isValidISODate(date) || !recipeId || !['breakfast', 'lunch', 'dinner', 'snack'].includes(type ?? '')) continue;
            db.insert('meal_plan_entries', {
                date,
                mealType: type as 'breakfast',
                recipeId,
                title: null,
                servings: null,
            });
            counts.meals++;
        }
        return counts;
    });
}
