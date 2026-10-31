// Calendar helpers working on local YYYY-MM-DD strings (no timezone drift).

export function toISODate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

export function fromISODate(value: string): Date {
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y, m - 1, d);
}

export function today(): string {
    return toISODate(new Date());
}

export function addDays(value: string, days: number): string {
    const date = fromISODate(value);
    date.setDate(date.getDate() + days);
    return toISODate(date);
}

/** Whole days from `a` to `b` (positive when b is later). */
export function daysBetween(a: string, b: string): number {
    const ms = fromISODate(b).getTime() - fromISODate(a).getTime();
    return Math.round(ms / 86_400_000);
}

export function startOfWeek(value: string, weekStartsOn: 0 | 1 = 0): string {
    const date = fromISODate(value);
    const diff = (date.getDay() - weekStartsOn + 7) % 7;
    return addDays(value, -diff);
}

export function weekDates(start: string): string[] {
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function isValidISODate(value: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    return toISODate(fromISODate(value)) === value;
}

export function monthKey(iso: string): string {
    return iso.slice(0, 7); // YYYY-MM
}

export function formatDay(value: string, opts: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'short', day: 'numeric' }): string {
    return fromISODate(value).toLocaleDateString(undefined, opts);
}

export function formatMonth(key: string): string {
    const [y, m] = key.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

export function relativeTime(iso: string, now: Date = new Date()): string {
    const seconds = Math.round((now.getTime() - new Date(iso).getTime()) / 1000);
    if (seconds < 45) return 'just now';
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours} h ago`;
    const days = Math.round(hours / 24);
    return days === 1 ? 'yesterday' : `${days} days ago`;
}
