import { ShoppingList } from '../../domain/types';
import { getDb } from '../db';

export interface ListInput {
    name: string;
    color: string;
    icon?: string;
    storeName?: string | null;
    budget?: number | null;
    isTemplate?: boolean;
}

export function createList(input: ListInput): ShoppingList {
    const db = getDb();
    const maxOrder = Math.max(-1, ...db.list('lists').map(l => l.sortOrder));
    return db.insert('lists', {
        name: input.name,
        color: input.color,
        icon: input.icon ?? 'cart',
        storeName: input.storeName ?? null,
        storeId: null,
        budget: input.budget ?? null,
        sortOrder: maxOrder + 1,
        isArchived: false,
        isTemplate: input.isTemplate ?? false,
        ownerId: db.actorId,
    });
}

export function updateList(id: string, patch: Partial<ShoppingList>): void {
    getDb().update('lists', id, patch);
}

export function setListArchived(id: string, isArchived: boolean): void {
    getDb().update('lists', id, { isArchived });
}

/** Delete a list and its items (soft deletes so other devices follow). */
export function deleteList(id: string): Promise<void> {
    const db = getDb();
    return db.transaction(() => {
        for (const item of db.list('items')) if (item.listId === id) db.remove('items', item.id);
        db.remove('lists', id);
    });
}

/** Copy a list (and its unchecked items) — used for templates in both directions. */
export function copyList(sourceId: string, overrides: Partial<ListInput>): Promise<ShoppingList> {
    const db = getDb();
    const source = db.get('lists', sourceId);
    if (!source) return Promise.reject(new Error('List not found'));
    return db.transaction(() => {
        const list = createList({
            name: overrides.name ?? source.name,
            color: overrides.color ?? source.color,
            icon: overrides.icon ?? source.icon,
            storeName: overrides.storeName ?? source.storeName,
            budget: overrides.budget ?? source.budget,
            isTemplate: overrides.isTemplate ?? false,
        });
        for (const item of db.list('items')) {
            if (item.listId !== sourceId || item.isChecked) continue;
            db.insert('items', {
                listId: list.id,
                name: item.name,
                category: item.category,
                quantity: item.quantity,
                unit: item.unit,
                notes: item.notes,
                price: item.price,
                isChecked: false,
                checkedAt: null,
                barcode: item.barcode,
                recipeId: null,
                addedBy: db.actorId,
                checkedBy: null,
            });
        }
        return list;
    });
}

export function reorderLists(orderedIds: string[]): Promise<void> {
    const db = getDb();
    return db.transaction(() => {
        orderedIds.forEach((id, index) => {
            if (db.get('lists', id)?.sortOrder !== index) db.update('lists', id, { sortOrder: index });
        });
    });
}
