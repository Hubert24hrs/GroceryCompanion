import { daysBetween } from './dates';
import { convert, areCompatible } from './units';
import { ListItem, PantryItem } from './types';

export type ExpiryStatus = 'expired' | 'soon' | 'ok' | 'none';

export const EXPIRING_SOON_DAYS = 3;

export function expiryStatus(item: Pick<PantryItem, 'expiresOn'>, todayIso: string): ExpiryStatus {
    if (!item.expiresOn) return 'none';
    const days = daysBetween(todayIso, item.expiresOn);
    if (days < 0) return 'expired';
    if (days <= EXPIRING_SOON_DAYS) return 'soon';
    return 'ok';
}

export function daysUntilExpiry(item: Pick<PantryItem, 'expiresOn'>, todayIso: string): number | null {
    return item.expiresOn ? daysBetween(todayIso, item.expiresOn) : null;
}

export function isLowStock(item: Pick<PantryItem, 'quantity' | 'lowStockThreshold'>): boolean {
    if (item.quantity <= 0) return true;
    return item.lowStockThreshold != null && item.quantity <= item.lowStockThreshold;
}

function singularize(word: string): string {
    if (word.length <= 3) return word;
    if (word.endsWith('ies')) return `${word.slice(0, -3)}y`;
    if (/(?:oes|ches|shes|xes|sses)$/.test(word)) return word.slice(0, -2);
    if (word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
    return word;
}

/** Normalized key used to match the same product across lists, pantry and recipes. */
export function itemKey(name: string): string {
    const words = name
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, '')
        .replace(/\s+/g, ' ')
        .trim()
        .split(' ');
    words[words.length - 1] = singularize(words[words.length - 1]);
    return words.join(' ');
}

export function findPantryMatch<T extends Pick<PantryItem, 'name' | 'deletedAt'>>(pantry: T[], name: string): T | undefined {
    const key = itemKey(name);
    return pantry.find(p => !p.deletedAt && itemKey(p.name) === key);
}

export type DuplicateWarning =
    | { kind: 'on-list'; item: ListItem }
    | { kind: 'in-pantry'; item: PantryItem }
    | null;

/**
 * Duplicate-purchase prevention: warn when an item is already waiting on the
 * list, or when the pantry holds a healthy (not low, not expired) supply.
 */
export function checkDuplicate(
    name: string,
    listItems: ListItem[],
    pantry: PantryItem[],
    todayIso: string,
): DuplicateWarning {
    const key = itemKey(name);
    const onList = listItems.find(i => !i.deletedAt && !i.isChecked && itemKey(i.name) === key);
    if (onList) return { kind: 'on-list', item: onList };
    const stocked = pantry.find(
        p => !p.deletedAt && itemKey(p.name) === key && !isLowStock(p) && expiryStatus(p, todayIso) !== 'expired',
    );
    if (stocked) return { kind: 'in-pantry', item: stocked };
    return null;
}

/**
 * How much of `needed` the pantry already covers, in the needed unit.
 * Unknown/incompatible units count as covered only when the pantry has stock
 * and the recipe gave no quantity.
 */
export function pantryCoverage(
    pantryItem: Pick<PantryItem, 'quantity' | 'unit'> | undefined,
    neededQty: number | null,
    neededUnit: string | null,
): number {
    if (!pantryItem || pantryItem.quantity <= 0) return 0;
    if (neededQty == null) return Infinity;
    if (!areCompatible(pantryItem.unit, neededUnit)) {
        // A pantry count of "2" with a recipe asking for "200 g" — we can't
        // compare, so treat it as present (the user said they have it).
        return pantryItem.unit == null || neededUnit == null ? neededQty : 0;
    }
    return convert(pantryItem.quantity, pantryItem.unit, neededUnit) ?? 0;
}
