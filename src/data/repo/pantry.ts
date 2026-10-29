import { autoCategorize } from '../../domain/categories';
import { findPantryMatch, isLowStock } from '../../domain/pantry';
import { displayName } from '../../domain/parsing';
import { Category, PantryItem, PantryLocation } from '../../domain/types';
import { convert, roundQuantity } from '../../domain/units';
import { getDb } from '../db';
import { addItem } from './items';

export interface PantryInput {
    name: string;
    quantity?: number;
    unit?: string | null;
    category?: Category;
    expiresOn?: string | null;
    lowStockThreshold?: number | null;
    location?: PantryLocation;
    barcode?: string | null;
    notes?: string | null;
}

function defaultLocation(category: Category): PantryLocation {
    if (category === 'frozen') return 'freezer';
    if (['dairy', 'meat', 'seafood', 'produce'].includes(category)) return 'fridge';
    return 'pantry';
}

/** Add stock; merges into an existing pantry row for the same product. */
export function addPantryItem(input: PantryInput): PantryItem {
    const db = getDb();
    const name = displayName(input.name);
    const qty = input.quantity ?? 1;
    const match = findPantryMatch(db.list('pantry_items'), name);
    if (match) {
        const add = convert(qty, input.unit ?? null, match.unit);
        if (add != null) {
            return db.update('pantry_items', match.id, {
                quantity: roundQuantity(match.quantity + add),
                // Keep the soonest expiry so alerts stay conservative.
                expiresOn:
                    input.expiresOn && (!match.expiresOn || input.expiresOn < match.expiresOn) ? input.expiresOn : match.expiresOn,
                barcode: match.barcode ?? input.barcode ?? null,
            })!;
        }
    }
    const category = input.category ?? autoCategorize(name);
    return db.insert('pantry_items', {
        name,
        category,
        quantity: qty,
        unit: input.unit ?? null,
        lowStockThreshold: input.lowStockThreshold ?? null,
        expiresOn: input.expiresOn ?? null,
        location: input.location ?? defaultLocation(category),
        barcode: input.barcode ?? null,
        notes: input.notes ?? null,
    });
}

export function updatePantryItem(id: string, patch: Partial<PantryItem>): void {
    getDb().update('pantry_items', id, patch);
}

export function adjustPantryQuantity(id: string, delta: number): PantryItem | undefined {
    const db = getDb();
    const item = db.get('pantry_items', id);
    if (!item) return undefined;
    return db.update('pantry_items', id, { quantity: Math.max(0, roundQuantity(item.quantity + delta)) });
}

export function deletePantryItem(id: string): void {
    getDb().remove('pantry_items', id);
}

export function restorePantryItem(id: string): void {
    getDb().update('pantry_items', id, { deletedAt: null });
}

/** Put every low-stock pantry item on a list. Returns how many were added. */
export function addLowStockToList(listId: string): Promise<number> {
    const db = getDb();
    return db.transaction(() => {
        const listKeys = new Set(
            db.list('items').filter(i => i.listId === listId && !i.isChecked).map(i => i.name.toLowerCase()),
        );
        let added = 0;
        for (const p of db.list('pantry_items')) {
            if (!isLowStock(p) || listKeys.has(p.name.toLowerCase())) continue;
            addItem(listId, { name: p.name, category: p.category, unit: p.unit, quantity: p.lowStockThreshold ?? null });
            added++;
        }
        return added;
    });
}
