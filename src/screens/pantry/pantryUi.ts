import { daysUntilExpiry, expiryStatus, ExpiryStatus } from '../../domain/pantry';
import { formatDay, fromISODate } from '../../domain/dates';
import { PantryItem, PantryLocation } from '../../domain/types';
import { IconName } from '../../ui/primitives';

export type PantryFilter = 'all' | 'attention' | PantryLocation;

export const LOCATIONS:{ key: PantryLocation; label: string; icon: IconName }[] = [
    { key: 'fridge', label: 'Fridge', icon: 'thermometer-outline' },
    { key: 'freezer', label: 'Freezer', icon: 'snow-outline' },
    { key: 'pantry', label: 'Pantry', icon: 'file-tray-stacked-outline' },
    { key: 'other', label: 'Other', icon: 'cube-outline' },
];

export function expiryLabel(item: Pick<PantryItem, 'expiresOn'>, todayIso: string): string | null {
    const days = daysUntilExpiry(item, todayIso);
    if (days == null || !item.expiresOn) return null;
    if (days < -1) return `Expired ${-days} days ago`;
    if (days === -1) return 'Expired yesterday';
    if (days === 0) return 'Expires today';
    if (days === 1) return 'Expires tomorrow';
    if (days <= 6) return `Expires in ${days} days`;
    return `Expires ${formatDay(item.expiresOn, { month: 'short', day: 'numeric' })}`;
}

/** Most urgent first: expired, then soonest expiry, then undated. */
export function byExpiry(todayIso: string) {
    const rank: Record<ExpiryStatus, number> = { expired: 0, soon: 1, ok: 2, none: 3 };
    return (a: PantryItem, b: PantryItem) =>
        rank[expiryStatus(a, todayIso)] - rank[expiryStatus(b, todayIso)] ||
        (a.expiresOn ?? '9999').localeCompare(b.expiresOn ?? '9999') ||
        a.name.localeCompare(b.name);
}

/** Sensible +/- step: grams and millilitres move in hundreds, everything else in ones. */
export function quantityStep(unit: string | null): number {
    return unit === 'g' || unit === 'ml' ? 100 : 1;
}

export function formatDateShort(iso: string): string {
    return fromISODate(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
