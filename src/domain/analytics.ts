import { monthKey } from './dates';
import { itemKey } from './pantry';
import { Category, Purchase } from './types';

const live = (purchases: Purchase[]) => purchases.filter(p => !p.deletedAt);

export function totalSpent(purchases: Purchase[]): number {
    return round2(live(purchases).reduce((sum, p) => sum + p.price, 0));
}

export function purchasesInMonth(purchases: Purchase[], month: string): Purchase[] {
    return live(purchases).filter(p => monthKey(p.purchasedAt.slice(0, 10)) === month);
}

/** Totals for the `count` months ending at `endMonth` (oldest first). */
export function monthlyTotals(purchases: Purchase[], endMonth: string, count: number): { month: string; total: number }[] {
    const [y, m] = endMonth.split('-').map(Number);
    const months = Array.from({ length: count }, (_, i) => {
        const d = new Date(y, m - 1 - (count - 1 - i), 1);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });
    return months.map(month => ({ month, total: totalSpent(purchasesInMonth(purchases, month)) }));
}

export function categoryBreakdown(purchases: Purchase[]): { category: Category; total: number; share: number }[] {
    const totals = new Map<Category, number>();
    for (const p of live(purchases)) totals.set(p.category, (totals.get(p.category) ?? 0) + p.price);
    const sum = [...totals.values()].reduce((a, b) => a + b, 0);
    return [...totals.entries()]
        .map(([category, total]) => ({ category, total: round2(total), share: sum ? total / sum : 0 }))
        .sort((a, b) => b.total - a.total);
}

export interface PricePoint {
    unitPrice: number;
    unit: string | null;
    storeName: string | null;
    purchasedAt: string;
}

export interface PriceSummary {
    key: string;
    name: string;
    unit: string | null;
    timesBought: number;
    last: PricePoint;
    lowest: PricePoint;
    average: number;
    /** Lowest average unit price per store, when bought at 2+ stores. */
    stores: { storeName: string; average: number }[];
}

/** Price history per product from the household's own purchases (no external price data). */
export function priceHistory(purchases: Purchase[]): PriceSummary[] {
    const groups = new Map<string, Purchase[]>();
    for (const p of live(purchases)) {
        if (p.price <= 0) continue;
        const key = `${itemKey(p.name)}|${p.unit ?? ''}`;
        groups.set(key, [...(groups.get(key) ?? []), p]);
    }
    const summaries: PriceSummary[] = [];
    for (const [key, list] of groups) {
        const points: PricePoint[] = list
            .map(p => ({
                unitPrice: p.price / (p.quantity && p.quantity > 0 ? p.quantity : 1),
                unit: p.unit,
                storeName: p.storeName,
                purchasedAt: p.purchasedAt,
            }))
            .sort((a, b) => a.purchasedAt.localeCompare(b.purchasedAt));
        const byStore = new Map<string, number[]>();
        for (const pt of points) {
            if (!pt.storeName) continue;
            byStore.set(pt.storeName, [...(byStore.get(pt.storeName) ?? []), pt.unitPrice]);
        }
        const stores = [...byStore.entries()]
            .map(([storeName, prices]) => ({ storeName, average: round2(avg(prices)) }))
            .sort((a, b) => a.average - b.average);
        summaries.push({
            key: key.split('|')[0],
            name: list[list.length - 1].name,
            unit: list[0].unit,
            timesBought: list.length,
            last: points[points.length - 1],
            lowest: points.reduce((lo, pt) => (pt.unitPrice < lo.unitPrice ? pt : lo)),
            average: round2(avg(points.map(p => p.unitPrice))),
            stores: stores.length >= 2 ? stores : [],
        });
    }
    return summaries.sort((a, b) => b.timesBought - a.timesBought);
}

/** Latest known unit price per product key, used for cost estimates. */
export function latestUnitPrices(purchases: Purchase[]): Map<string, number> {
    const map = new Map<string, number>();
    for (const s of priceHistory(purchases)) if (!map.has(s.key)) map.set(s.key, s.last.unitPrice);
    return map;
}

export function insights(
    purchases: Purchase[],
    month: string,
    monthlyBudget: number | null,
    formatMoney: (n: number) => string,
): string[] {
    const result: string[] = [];
    const [current, previous] = [...monthlyTotals(purchases, month, 2)].reverse();
    if (previous.total > 0 && current.total > 0) {
        const change = (current.total - previous.total) / previous.total;
        if (Math.abs(change) >= 0.05) {
            result.push(
                change < 0
                    ? `You've spent ${Math.round(-change * 100)}% less than last month.`
                    : `Spending is up ${Math.round(change * 100)}% on last month.`,
            );
        }
    }
    if (monthlyBudget) {
        const left = monthlyBudget - current.total;
        result.push(left >= 0 ? `${formatMoney(left)} left in this month's budget.` : `${formatMoney(-left)} over this month's budget.`);
    }
    const top = categoryBreakdown(purchasesInMonth(purchases, month))[0];
    if (top && top.share >= 0.3) result.push(`${Math.round(top.share * 100)}% of this month's spending went to ${top.category.replace('_', ' ')}.`);

    for (const s of priceHistory(purchases)) {
        if (s.stores.length < 2) continue;
        const [cheap, ...others] = s.stores;
        const dear = others[others.length - 1];
        const saving = dear.average - cheap.average;
        if (saving / dear.average >= 0.1) {
            result.push(`${s.name} is cheapest at ${cheap.storeName} (${formatMoney(cheap.average)} vs ${formatMoney(dear.average)} at ${dear.storeName}).`);
            break;
        }
    }
    return result;
}

function avg(values: number[]): number {
    return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

function round2(n: number): number {
    return Math.round(n * 100) / 100;
}
