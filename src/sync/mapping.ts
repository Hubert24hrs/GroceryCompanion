import { isCategory } from '../domain/categories';
import { SyncedTable, TableRecordMap } from '../domain/types';

const BASE = ['id', 'household_id', 'created_at', 'updated_at', 'deleted_at'];

/** Remote columns per table. Anything else (local-only fields) never leaves the device. */
export const COLUMNS: Record<SyncedTable, string[]> = {
    lists: [...BASE, 'name', 'color', 'icon', 'store_name', 'store_id', 'budget', 'sort_order', 'is_archived', 'is_template', 'owner_id'],
    items: [
        ...BASE, 'list_id', 'name', 'category', 'quantity', 'unit', 'notes', 'price', 'is_checked', 'checked_at',
        'barcode', 'recipe_id', 'added_by', 'checked_by',
    ],
    pantry_items: [...BASE, 'name', 'category', 'quantity', 'unit', 'low_stock_threshold', 'expires_on', 'location', 'barcode', 'notes'],
    recipes: [
        ...BASE, 'title', 'description', 'image_url', 'source_name', 'source_url', 'prep_minutes', 'cook_minutes',
        'servings', 'calories', 'ingredients', 'instructions', 'tags', 'collection', 'is_favorite', 'estimated_cost',
    ],
    meal_plan_entries: [...BASE, 'date', 'meal_type', 'recipe_id', 'title', 'servings'],
    purchases: [...BASE, 'list_id', 'name', 'category', 'quantity', 'unit', 'price', 'store_name', 'purchased_at'],
};

/** Columns Postgres returns as numeric that must be numbers locally. */
const NUMERIC = new Set(['quantity', 'price', 'budget', 'low_stock_threshold', 'estimated_cost', 'servings', 'calories', 'prep_minutes', 'cook_minutes', 'sort_order']);
const BOOLEAN = new Set(['is_archived', 'is_template', 'is_checked', 'is_favorite']);

const toSnake = (key: string) => key.replace(/[A-Z]/g, c => `_${c.toLowerCase()}`);
const toCamel = (key: string) => key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

export type RemoteRow = Record<string, unknown>;

export function toRemote<T extends SyncedTable>(table: T, record: TableRecordMap[T]): RemoteRow {
    const row: RemoteRow = {};
    const source = record as unknown as Record<string, unknown>;
    for (const column of COLUMNS[table]) {
        const value = source[toCamel(column)];
        row[column] = value === undefined ? null : value;
    }
    return row;
}

export function fromRemote<T extends SyncedTable>(table: T, row: RemoteRow): TableRecordMap[T] {
    const record: Record<string, unknown> = {};
    for (const column of COLUMNS[table]) {
        let value = row[column] ?? null;
        if (value != null && NUMERIC.has(column)) value = Number(value);
        if (BOOLEAN.has(column)) value = value === true;
        if (value != null && (column.endsWith('_at') || column === 'purchased_at') && typeof value === 'string') {
            value = new Date(value).toISOString(); // normalise "+00:00" to "Z" so string compares order correctly
        }
        record[toCamel(column)] = value;
    }
    if ('category' in record && !isCategory(record.category)) record.category = 'other';
    if (table === 'recipes') {
        record.ingredients = Array.isArray(record.ingredients) ? record.ingredients : [];
        record.instructions = Array.isArray(record.instructions) ? record.instructions : [];
        record.tags = Array.isArray(record.tags) ? record.tags : [];
    }
    return record as unknown as TableRecordMap[T];
}

export { toSnake };
