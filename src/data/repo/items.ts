import { autoCategorize } from '../../domain/categories';
import { today } from '../../domain/dates';
import { checkDuplicate, DuplicateWarning, findPantryMatch, itemKey } from '../../domain/pantry';
import { ParsedItem, displayName } from '../../domain/parsing';
import { Category, ListItem } from '../../domain/types';
import { convert, roundQuantity } from '../../domain/units';
import { getDb } from '../db';

export interface NewItemInput {
    name: string;
    quantity?: number | null;
    unit?: string | null;
    notes?: string | null;
    category?: Category;
    price?: number | null;
    barcode?: string | null;
    recipeId?: string | null;
}

export interface AddResult {
    item: ListItem;
    merged: boolean; // quantity added to an existing line instead of a new row
    warning: DuplicateWarning;
}

function recentFor(name: string) {
    return getDb().get('recent_items', itemKey(name));
}

function rememberRecent(name: string, category: Category, unit: string | null) {
    const db = getDb();
    const id = itemKey(name);
    const prev = db.get('recent_items', id);
    db.putLocal('recent_items', {
        id,
        name: displayName(name),
        category,
        unit: unit ?? prev?.unit ?? null,
        useCount: (prev?.useCount ?? 0) + 1,
        lastUsed: new Date().toISOString(),
    });
}

/**
 * Add an item to a list. If the same product is already waiting on the list
 * with a compatible unit, the quantity is merged instead of duplicating it.
 * Returns a pantry warning so the UI can offer "undo".
 */
export function addItem(listId: string, input: NewItemInput): AddResult {
    const db = getDb();
    const name = displayName(input.name);
    const listItems = db.list('items').filter(i => i.listId === listId);
    const warning = checkDuplicate(name, listItems, db.list('pantry_items'), today());

    if (warning?.kind === 'on-list') {
        const existing = warning.item;
        const addQty = input.quantity ?? 1;
        const converted = convert(addQty, input.unit ?? null, existing.unit);
        if (converted != null) {
            const updated = db.update('items', existing.id, {
                quantity: roundQuantity((existing.quantity ?? 1) + converted),
                notes: input.notes ?? existing.notes,
            })!;
            rememberRecent(name, existing.category, existing.unit);
            return { item: updated, merged: true, warning };
        }
    }

    // Category precedence: explicit → what the user picked last time → keyword guess.
    const category = input.category ?? recentFor(name)?.category ?? autoCategorize(name);
    const item = db.insert('items', {
        listId,
        name,
        category,
        quantity: input.quantity ?? null,
        unit: input.unit ?? null,
        notes: input.notes ?? null,
        price: input.price ?? null,
        isChecked: false,
        checkedAt: null,
        barcode: input.barcode ?? null,
        recipeId: input.recipeId ?? null,
        addedBy: db.actorId,
        checkedBy: null,
    });
    rememberRecent(name, category, item.unit);
    return { item, merged: false, warning: warning?.kind === 'in-pantry' ? warning : null };
}

export function addParsedItems(listId: string, parsed: ParsedItem[]): Promise<AddResult[]> {
    return getDb().transaction(() =>
        parsed.map(p => addItem(listId, { name: p.name, quantity: p.quantity, unit: p.unit, notes: p.notes })),
    );
}

export function updateItem(id: string, patch: Partial<ListItem>): void {
    const db = getDb();
    const next = db.update('items', id, patch);
    // Learn category corrections for next time.
    if (next && patch.category) rememberRecent(next.name, patch.category, next.unit);
}

export function toggleItem(id: string): ListItem | undefined {
    const db = getDb();
    const item = db.get('items', id);
    if (!item) return undefined;
    const isChecked = !item.isChecked;
    return db.update('items', id, {
        isChecked,
        checkedAt: isChecked ? new Date().toISOString() : null,
        checkedBy: isChecked ? db.actorId : null,
    });
}

export function deleteItem(id: string): void {
    getDb().remove('items', id);
}

/** Bring back a soft-deleted item (undo). */
export function restoreItem(id: string): void {
    getDb().update('items', id, { deletedAt: null });
}

export function clearChecked(listId: string): Promise<string[]> {
    const db = getDb();
    return db.transaction(() => {
        const ids = db.list('items').filter(i => i.listId === listId && i.isChecked).map(i => i.id);
        ids.forEach(id => db.remove('items', id));
        return ids;
    });
}

export function uncheckAll(listId: string): Promise<void> {
    const db = getDb();
    return db.transaction(() => {
        for (const i of db.list('items')) {
            if (i.listId === listId && i.isChecked) db.update('items', i.id, { isChecked: false, checkedAt: null, checkedBy: null });
        }
    });
}

export interface TripSummary {
    purchased: number;
    restocked: number;
    spent: number;
}

/**
 * Finish a shopping trip: every checked item becomes a purchase (price history
 * and budgets), optionally restocks the pantry, and leaves the list.
 */
export function finishTrip(listId: string, options: { restockPantry: boolean }): Promise<TripSummary> {
    const db = getDb();
    const list = db.get('lists', listId);
    const purchasedAt = new Date().toISOString();
    return db.transaction(() => {
        const summary: TripSummary = { purchased: 0, restocked: 0, spent: 0 };
        const checked = db.list('items').filter(i => i.listId === listId && i.isChecked);
        for (const item of checked) {
            if (item.price != null && item.price > 0) {
                db.insert('purchases', {
                    listId,
                    name: item.name,
                    category: item.category,
                    quantity: item.quantity,
                    unit: item.unit,
                    price: item.price,
                    storeName: list?.storeName ?? null,
                    purchasedAt,
                });
                summary.spent += item.price;
            }
            if (options.restockPantry && !['household', 'personal_care'].includes(item.category)) {
                restockPantry(item);
                summary.restocked++;
            }
            db.remove('items', item.id);
            summary.purchased++;
        }
        summary.spent = Math.round(summary.spent * 100) / 100;
        return summary;
    });
}

function restockPantry(item: ListItem) {
    const db = getDb();
    const qty = item.quantity ?? 1;
    const match = findPantryMatch(db.list('pantry_items'), item.name);
    if (match) {
        const add = convert(qty, item.unit, match.unit);
        db.update('pantry_items', match.id, {
            quantity: roundQuantity(match.quantity + (add ?? 1)),
            barcode: match.barcode ?? item.barcode,
        });
        return;
    }
    db.insert('pantry_items', {
        name: item.name,
        category: item.category,
        quantity: qty,
        unit: item.unit,
        lowStockThreshold: null,
        expiresOn: null,
        location: item.category === 'frozen' ? 'freezer' : ['dairy', 'meat', 'seafood'].includes(item.category) ? 'fridge' : 'pantry',
        barcode: item.barcode,
        notes: null,
    });
}

/** Autocomplete: recent items matching the prefix, most used first. */
export function suggestItems(query: string, limit = 8) {
    const q = itemKey(query);
    const recents = getDb().list('recent_items');
    const filtered = q ? recents.filter(r => r.id.includes(q)) : recents;
    return [...filtered]
        .sort((a, b) => Number(b.id.startsWith(q)) - Number(a.id.startsWith(q)) || b.useCount - a.useCount || b.lastUsed.localeCompare(a.lastUsed))
        .slice(0, limit);
}
