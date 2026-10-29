import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RootScreenProps } from '../navigation/navigation';
import { categoryBreakdown, insights, monthlyTotals, priceHistory, purchasesInMonth, totalSpent } from '../domain/analytics';
import { CATEGORIES } from '../domain/categories';
import { formatMonth, monthKey, today } from '../domain/dates';
import { hasFeature } from '../domain/entitlements';
import { formatQuantity } from '../domain/units';
import { useTable } from '../state/hooks';
import { formatMoney, usePrefs } from '../state/prefs';
import { useIsPro } from '../state/session';
import { Button, Card, EmptyState, ProgressBar, SectionTitle, Text } from '../ui/primitives';
import { layout } from '../ui/Screen';
import { radius, spacing, useTheme } from '../ui/theme';

const HISTORY_MONTHS = 6;

function ProLock({ title, detail, onPress }: { title: string; detail: string; onPress: () => void }) {
    const { colors } = useTheme();
    return (
        <Card onPress={onPress} accessibilityLabel={`${title}. ${detail}. See Pro.`} style={[styles.lock, { backgroundColor: colors.accentSoft, borderColor: colors.accentSoft }]}>
            <Ionicons name="lock-closed" size={20} color={colors.accent} />
            <View style={{ flex: 1 }}>
                <Text variant="label">{title}</Text>
                <Text variant="caption" muted>
                    {detail}
                </Text>
            </View>
            <Text variant="label" color={colors.accent}>
                See Pro
            </Text>
        </Card>
    );
}

/** Spending against budget, by month and category, plus price history per item. */
export function SpendingScreen({ navigation }: RootScreenProps<'Spending'>) {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const purchases = useTable('purchases');
    const budget = usePrefs(s => s.prefs.monthlyBudget);
    const isPro = useIsPro();
    const fullHistory = hasFeature(isPro, 'fullAnalytics');
    const priceTracking = hasFeature(isPro, 'priceInsights');

    const current = monthKey(today());
    const [month, setMonth] = useState(current);
    const shownMonth = fullHistory ? month : current;

    const months = useMemo(() => monthlyTotals(purchases, current, HISTORY_MONTHS), [purchases, current]);
    const inMonth = useMemo(() => purchasesInMonth(purchases, shownMonth), [purchases, shownMonth]);
    const spent = totalSpent(inMonth);
    const categories = useMemo(() => categoryBreakdown(inMonth), [inMonth]);
    const tips = useMemo(() => insights(purchases, shownMonth, budget, n => formatMoney(n)), [purchases, shownMonth, budget]);
    const prices = useMemo(() => priceHistory(purchases).filter(p => p.timesBought >= 2).slice(0, 12), [purchases]);
    const recent = useMemo(() => [...inMonth].sort((a, b) => b.purchasedAt.localeCompare(a.purchasedAt)).slice(0, 15), [inMonth]);
    const maxMonth = Math.max(...months.map(m => m.total), budget ?? 0, 1);
    const goPro = () => navigation.navigate('Pro');

    if (purchases.length === 0) {
        return (
            <View style={[styles.root, { backgroundColor: colors.background }]}>
                <ScrollView contentContainerStyle={styles.content}>
                    <Card>
                        <EmptyState
                            icon="wallet-outline"
                            title="No spending yet"
                            message="Add prices to items on a list, then tap “Finish trip”. Each trip lands here with totals by month, aisle and store."
                        />
                    </Card>
                </ScrollView>
            </View>
        );
    }

    return (
        <View style={[styles.root, { backgroundColor: colors.background }]}>
            <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}>
                <Card style={{ gap: spacing.sm }}>
                    <Text variant="caption" muted>
                        {formatMonth(shownMonth)}
                    </Text>
                    <View style={styles.totalRow}>
                        <Text variant="title">{formatMoney(spent)}</Text>
                        {budget ? (
                            <Text variant="caption" muted>
                                of {formatMoney(budget)} budget
                            </Text>
                        ) : null}
                    </View>
                    {budget ? <ProgressBar value={spent / budget} color={spent > budget ? colors.danger : colors.primary} /> : null}
                    {tips.map(t => (
                        <View key={t} style={styles.tip}>
                            <Ionicons name="bulb-outline" size={16} color={colors.accent} />
                            <Text variant="caption" style={{ flex: 1 }}>
                                {t}
                            </Text>
                        </View>
                    ))}
                </Card>

                <View>
                    <SectionTitle title="Last 6 months" />
                    {fullHistory ? (
                        <Card>
                            <View style={styles.chart} accessibilityLabel={months.map(m => `${formatMonth(m.month)}: ${formatMoney(m.total)}`).join(', ')}>
                                {budget ? (
                                    <View pointerEvents="none" style={styles.budgetArea}>
                                        <View style={[styles.budgetLine, { bottom: `${(budget / maxMonth) * 100}%`, borderColor: colors.danger }]} />
                                    </View>
                                ) : null}
                                {months.map(m => {
                                    const selected = m.month === shownMonth;
                                    return (
                                        <Pressable
                                            key={m.month}
                                            onPress={() => setMonth(m.month)}
                                            accessibilityRole="button"
                                            accessibilityState={{ selected }}
                                            accessibilityLabel={`${formatMonth(m.month)}, ${formatMoney(m.total)}`}
                                            style={styles.barCol}
                                        >
                                            <View style={styles.barTrack}>
                                                <View
                                                    style={[
                                                        styles.bar,
                                                        { height: `${Math.max(2, (m.total / maxMonth) * 100)}%`, backgroundColor: selected ? colors.primary : colors.primarySoft },
                                                    ]}
                                                />
                                            </View>
                                            <Text variant="caption" muted={!selected} style={selected ? { fontWeight: '700' } : undefined}>
                                                {formatMonth(m.month).slice(0, 3)}
                                            </Text>
                                        </Pressable>
                                    );
                                })}
                            </View>
                            {budget ? (
                                <Text variant="caption" muted>
                                    Red line: your {formatMoney(budget)} monthly budget. Tap a month to see its details.
                                </Text>
                            ) : (
                                <Text variant="caption" muted>
                                    Tap a month to see its details.
                                </Text>
                            )}
                        </Card>
                    ) : (
                        <ProLock title="Spending history" detail="Compare months and spot trends. The free plan shows the current month." onPress={goPro} />
                    )}
                </View>

                <View>
                    <SectionTitle title="By aisle" />
                    <Card style={{ gap: spacing.md }}>
                        {categories.length === 0 ? <Text muted>No purchases this month.</Text> : null}
                        {categories.map(c => (
                            <View key={c.category} style={{ gap: 4 }}>
                                <View style={styles.catRow}>
                                    <MaterialCommunityIcons name={CATEGORIES[c.category].icon as never} size={16} color={CATEGORIES[c.category].color} />
                                    <Text style={{ flex: 1 }}>{CATEGORIES[c.category].label}</Text>
                                    <Text variant="label">{formatMoney(c.total)}</Text>
                                    <Text variant="caption" muted style={{ width: 40, textAlign: 'right' }}>
                                        {Math.round(c.share * 100)}%
                                    </Text>
                                </View>
                                <ProgressBar value={c.share} color={CATEGORIES[c.category].color} />
                            </View>
                        ))}
                    </Card>
                </View>

                <View>
                    <SectionTitle title="Price tracking" />
                    {!priceTracking ? (
                        <ProLock title="Price tracking" detail="See what you usually pay for each item and which store is cheapest." onPress={goPro} />
                    ) : prices.length === 0 ? (
                        <Card>
                            <Text muted>Prices appear here once you’ve bought the same item on two trips.</Text>
                        </Card>
                    ) : (
                        <Card style={{ padding: 0 }}>
                            {prices.map((p, i) => (
                                <View key={p.key + p.unit} style={[styles.priceRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
                                    <View style={{ flex: 1, gap: 2 }}>
                                        <Text numberOfLines={1}>{p.name}</Text>
                                        <Text variant="caption" muted numberOfLines={2}>
                                            Bought {p.timesBought}× · usually {formatMoney(p.average)}
                                            {p.unit && p.unit !== 'pc' ? ` per ${p.unit}` : ''}
                                            {p.stores.length ? ` · cheapest at ${p.stores[0].storeName}` : ''}
                                        </Text>
                                    </View>
                                    <View style={{ alignItems: 'flex-end' }}>
                                        <Text variant="label">{formatMoney(p.last.unitPrice)}</Text>
                                        <Text variant="caption" color={p.last.unitPrice > p.average * 1.05 ? colors.danger : p.last.unitPrice < p.average * 0.95 ? colors.primary : colors.textMuted}>
                                            {p.last.unitPrice > p.average * 1.05 ? 'above usual' : p.last.unitPrice < p.average * 0.95 ? 'below usual' : 'usual price'}
                                        </Text>
                                    </View>
                                </View>
                            ))}
                        </Card>
                    )}
                </View>

                <View>
                    <SectionTitle title="Purchases" />
                    <Card style={{ padding: 0 }}>
                        {recent.length === 0 ? (
                            <Text muted style={{ padding: spacing.lg }}>
                                Nothing bought in {formatMonth(shownMonth)}.
                            </Text>
                        ) : (
                            recent.map((p, i) => (
                                <View key={p.id} style={[styles.priceRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
                                    <View style={{ flex: 1 }}>
                                        <Text numberOfLines={1}>{p.name}</Text>
                                        <Text variant="caption" muted>
                                            {new Date(p.purchasedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                            {p.storeName ? ` · ${p.storeName}` : ''}
                                            {p.quantity ? ` · ${formatQuantity(p.quantity, p.unit)}` : ''}
                                        </Text>
                                    </View>
                                    <Text variant="label">{formatMoney(p.price)}</Text>
                                </View>
                            ))
                        )}
                    </Card>
                </View>

                {!isPro ? <Button title="Unlock full history and price tracking" icon="sparkles" variant="accent" onPress={goPro} /> : null}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1 },
    content: { padding: spacing.lg, gap: spacing.xl, ...layout.page },
    totalRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm, flexWrap: 'wrap' },
    tip: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
    lock: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    chart: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
    // Same height and offset as the bar tracks, so the line sits at the budget's bar height.
    budgetArea: { position: 'absolute', left: 0, right: 0, top: 0, height: 130 },
    budgetLine: { position: 'absolute', left: 0, right: 0, borderTopWidth: 1, borderStyle: 'dashed' },
    barCol: { flex: 1, alignItems: 'center', gap: 4 },
    barTrack: { height: 130, width: '70%', justifyContent: 'flex-end' },
    bar: { width: '100%', borderTopLeftRadius: radius.sm, borderTopRightRadius: radius.sm },
    catRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    priceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
});
