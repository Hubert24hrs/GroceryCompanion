import { addDays, daysBetween } from './dates';
import { PantryItem } from './types';

/** Reminders go off at this local hour. */
export const ALERT_HOUR = 9;
/** Android caps pending alarms per app; a month of daily alerts is plenty. */
const MAX_ALERTS = 30;

export interface ExpiryAlert {
    date: string;
    title: string;
    body: string;
}

function whenLabel(days: number): string {
    if (days <= 0) return 'today';
    return days === 1 ? 'tomorrow' : `in ${days} days`;
}

/**
 * One reminder per day, `daysBefore` days ahead of each item's expiry. Items
 * already inside that window are reminded at the next ALERT_HOUR, unless they
 * would have expired by then.
 */
export function planExpiryAlerts(
    pantry: Pick<PantryItem, 'name' | 'quantity' | 'expiresOn' | 'deletedAt'>[],
    todayIso: string,
    daysBefore: number,
    hourNow: number,
): ExpiryAlert[] {
    const firstDay = hourNow < ALERT_HOUR ? todayIso : addDays(todayIso, 1);
    const byDay = new Map<string, { name: string; days: number }[]>();
    for (const item of pantry) {
        if (item.deletedAt || !item.expiresOn || item.quantity <= 0) continue;
        const due = addDays(item.expiresOn, -daysBefore);
        const day = due < firstDay ? firstDay : due;
        if (day > item.expiresOn) continue;
        byDay.set(day, [...(byDay.get(day) ?? []), { name: item.name, days: daysBetween(day, item.expiresOn) }]);
    }
    return [...byDay.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(0, MAX_ALERTS)
        .map(([date, items]) => {
            const sorted = [...items].sort((a, b) => a.days - b.days || a.name.localeCompare(b.name));
            const [first] = sorted;
            if (sorted.length === 1) return { date, title: 'Use it soon', body: `${first.name} expires ${whenLabel(first.days)}.` };
            const names = sorted.slice(0, 3).map(i => i.name).join(', ');
            const more = sorted.length > 3 ? ` and ${sorted.length - 3} more` : '';
            return { date, title: `${sorted.length} pantry items expire soon`, body: `${names}${more}. The first expires ${whenLabel(first.days)}.` };
        });
}
