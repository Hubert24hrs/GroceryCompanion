import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { TabScreenProps } from '../navigation/navigation';
import { insights, purchasesInMonth, totalSpent } from '../domain/analytics';
import { canCreateList, FREE_LIMITS } from '../domain/entitlements';
import { formatDay, monthKey, relativeTime, today } from '../domain/dates';
import { expiryStatus, isLowStock } from '../domain/pantry';
import { canEdit } from '../domain/validation';
import { useTable } from '../state/hooks';
import { formatMoney, usePrefs } from '../state/prefs';
import { useIsPro, useSession } from '../state/session';
import { useSyncState } from '../state/sync';
import { toast } from '../state/toast';
import { Banner, Card, IconButton, IconName, ProgressBar, SectionTitle, Text } from '../ui/primitives';
import { TabScreen } from '../ui/Screen';
import { radius, spacing, useTheme } from '../ui/theme';
import { countItems, ListCard } from './lists/ListCard';
import { MEAL_LABEL, MEAL_ORDER } from './mealplan/mealUi';
import { ListFormSheet } from './lists/ListFormSheet';

function greeting(): string {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

function SyncPill() {
    const { colors } = useTheme();
    const user = useSession(s => s.user);
    const sync = useSyncState();
    let icon: IconName = 'phone-portrait-outline';
    let label = 'On this device';
    if (user) {
        if (sync.status === 'syncing') [icon, label] = ['sync', 'Syncing…'];
        else if (sync.status === 'offline') [icon, label] = ['cloud-offline-outline', sync.pending ? `Offline · ${sync.pending} waiting` : 'Offline'];
        else if (sync.status === 'error' || sync.failed.length) [icon, label] = ['warning-outline', 'Sync problem'];
        else if (sync.pending) [icon, label] = ['cloud-upload-outline', `${sync.pending} to sync`];
        else [icon, label] = ['cloud-done-outline', sync.lastSyncedAt ? `Synced ${relativeTime(sync.lastSyncedAt)}` : 'Synced'];
    }
    return (
        <View style={[styles.pill, { backgroundColor: colors.surfaceAlt }]} accessibilityLabel={`Sync status: ${label}`}>
            <Ionicons name={icon} size={14} color={colors.textMuted} />
            <Text variant="caption" muted>
                {label}
            </Text>
        </View>
    );
}

function StatTile({ icon, tint, value, label, onPress }: { icon: IconName; tint: string; value: string; label: string; onPress: () => void }) {
    const { colors } = useTheme();
    return (
        <Card onPress={onPress} style={styles.tile} accessibilityLabel={`${value} ${label}`}>
            <View style={[styles.tileIcon, { backgroundColor: tint + '22' }]}>
                <Ionicons name={icon} size={18} color={tint} />
            </View>
            <Text variant="heading">{value}</Text>
            <Text variant="caption" muted>
                {label}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} style={styles.tileChevron} />
        </Card>
    );
}

export function HomeScreen({ navigation }: TabScreenProps<'Home'>) {
    const { colors } = useTheme();
    const householdName = useSession(s => s.householdName);
    const storageWarning = useSession(s => s.storageWarning);
    const editable = canEdit(useSession(s => s.role));
    const isPro = useIsPro();
    const budget = usePrefs(s => s.prefs.monthlyBudget);
    const lists = useTable('lists');
    const items = useTable('items');
    const pantry = useTable('pantry_items');
    const meals = useTable('meal_plan_entries');
    const recipes = useTable('recipes');
    const purchases = useTable('purchases');
    const [formOpen, setFormOpen] = useState(false);

    const day = today();
    const activeLists = useMemo(
        () => lists.filter(l => !l.isArchived && !l.isTemplate).sort((a, b) => a.sortOrder - b.sortOrder),
        [lists],
    );
    const counts = useMemo(() => countItems(items), [items]);

    const pantryAlerts = useMemo(() => {
        let expiring = 0;
        let low = 0;
        for (const p of pantry) {
            const s = expiryStatus(p, day);
            if (s === 'expired' || s === 'soon') expiring++;
            if (isLowStock(p)) low++;
        }
        return { expiring, low };
    }, [pantry, day]);

    const todaysMeals = useMemo(() => {
        const byId = new Map(recipes.map(r => [r.id, r]));
        return meals
            .filter(m => m.date === day)
            .sort((a, b) => MEAL_ORDER[a.mealType] - MEAL_ORDER[b.mealType])
            .map(m => ({ id: m.id, type: m.mealType, title: (m.recipeId && byId.get(m.recipeId)?.title) || m.title || 'Untitled meal' }));
    }, [meals, recipes, day]);

    const month = monthKey(day);
    const spent = useMemo(() => totalSpent(purchasesInMonth(purchases, month)), [purchases, month]);
    const tip = useMemo(() => insights(purchases, month, budget, n => formatMoney(n))[0], [purchases, month, budget]);

    const newList = () => {
        if (!canCreateList(isPro, activeLists.length)) {
            toast(`The free plan includes ${FREE_LIMITS.activeLists} active lists.`, { tone: 'warning', actionLabel: 'See Pro', onAction: () => navigation.navigate('Pro') });
            return;
        }
        setFormOpen(true);
    };

    return (
        <TabScreen title={householdName} subtitle={greeting()} right={
                <>
                    <Pressable onPress={() => navigation.navigate('Settings')} accessibilityRole="button" accessibilityHint="Opens settings">
                        <SyncPill />
                    </Pressable>
                    <IconButton icon="settings-outline" label="Settings" onPress={() => navigation.navigate('Settings')} filled />
                </>
            }
        >
            {storageWarning ? <Banner tone="danger" message={storageWarning} /> : null}

            <View>
                <SectionTitle title="Your lists" action={activeLists.length ? 'See all' : undefined} onAction={() => navigation.navigate('Lists')} />
                {activeLists.length ? (
                    <View style={{ gap: spacing.sm }}>
                        {activeLists.slice(0, 3).map(l => (
                            <ListCard key={l.id} list={l} counts={counts.get(l.id)} onPress={() => navigation.navigate('ListDetail', { listId: l.id })} />
                        ))}
                    </View>
                ) : (
                    <Card onPress={editable ? newList : undefined} style={styles.cta}>
                        <View style={[styles.ctaIcon, { backgroundColor: colors.primary }]}>
                            <Ionicons name="add" size={24} color={colors.onPrimary} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text variant="subheading">Start your first list</Text>
                            <Text variant="caption" muted>
                                Items sort themselves by aisle as you add them.
                            </Text>
                        </View>
                    </Card>
                )}
            </View>

            <View style={styles.tiles}>
                <StatTile
                    icon="time-outline"
                    tint={pantryAlerts.expiring ? colors.accent : colors.primary}
                    value={String(pantryAlerts.expiring)}
                    label={pantryAlerts.expiring === 1 ? 'item expiring' : 'items expiring'}
                    onPress={() => navigation.navigate('Pantry', { filter: 'attention' })}
                />
                <StatTile
                    icon="trending-down"
                    tint={pantryAlerts.low ? colors.warning : colors.primary}
                    value={String(pantryAlerts.low)}
                    label="running low"
                    onPress={() => navigation.navigate('Pantry', { filter: 'attention' })}
                />
            </View>

            <View>
                <SectionTitle title="Today" action="Meal plan" onAction={() => navigation.navigate('MealPlan')} />
                <Card style={{ gap: spacing.md }}>
                    <Text variant="caption" muted>
                        {formatDay(day)}
                    </Text>
                    {todaysMeals.length ? (
                        todaysMeals.map(m => (
                            <View key={m.id} style={styles.meal}>
                                <Text variant="label" muted style={{ width: 82 }}>
                                    {MEAL_LABEL[m.type]}
                                </Text>
                                <Text style={{ flex: 1 }} numberOfLines={1}>
                                    {m.title}
                                </Text>
                            </View>
                        ))
                    ) : (
                        <Text muted>Nothing planned yet. Pick a recipe and its ingredients can go straight onto a list.</Text>
                    )}
                </Card>
            </View>

            <View>
                <SectionTitle title="Spending this month" action="Details" onAction={() => navigation.navigate('Spending')} />
                <Card style={{ gap: spacing.sm }} onPress={() => navigation.navigate('Spending')} accessibilityLabel="Open spending details">
                    <View style={styles.spendRow}>
                        <Text variant="title" style={{ fontSize: 26 }}>
                            {formatMoney(spent)}
                        </Text>
                        {budget ? (
                            <Text variant="caption" muted>
                                of {formatMoney(budget)}
                            </Text>
                        ) : null}
                    </View>
                    {budget ? <ProgressBar value={spent / budget} color={spent > budget ? colors.danger : colors.primary} /> : null}
                    <Text variant="caption" muted>
                        {tip ?? (spent > 0 ? 'Based on the trips you finished this month.' : 'Finish a shopping trip with prices to start tracking spending.')}
                    </Text>
                </Card>
            </View>

            <ListFormSheet
                visible={formOpen}
                onClose={() => setFormOpen(false)}
                onSaved={l => navigation.navigate('ListDetail', { listId: l.id })}
            />
        </TabScreen>
    );
}

const styles = StyleSheet.create({
    pill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.pill, },
    tiles: { flexDirection: 'row', gap: spacing.md },
    tile: { flex: 1, gap: 2 },
    tileIcon: { width: 32, height: 32, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs },
    tileChevron: { position: 'absolute', top: spacing.lg, right: spacing.md },
    cta: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    ctaIcon: { width: 42, height: 42, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
    meal: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    spendRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
});
