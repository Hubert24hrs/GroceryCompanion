import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { TabScreenProps } from '../navigation/navigation';
import { planMeal, plannedRecipes, removeMeal, restoreMeal } from '../data/repo';
import { addDays, formatDay, startOfWeek, today, weekDates } from '../domain/dates';
import { MealPlanEntry } from '../domain/types';
import { canEdit } from '../domain/validation';
import { useTable } from '../state/hooks';
import { useSession } from '../state/session';
import { toast } from '../state/toast';
import { Button, Card, IconButton, Text } from '../ui/primitives';
import { TabScreen } from '../ui/Screen';
import { ActionSheet } from '../ui/Sheet';
import { radius, spacing, useTheme } from '../ui/theme';
import { MEAL_LABEL, MEAL_ORDER, MEAL_TYPES, WEEK_STARTS_ON } from './mealplan/mealUi';
import { PlanMealSheet, PlanTarget } from './mealplan/PlanMealSheet';
import { AddToListSheet } from './recipes/AddToListSheet';
import { RecipeImage } from './recipes/RecipeImage';

function weekLabel(start: string, current: string): string {
    if (start === current) return 'This week';
    if (start === addDays(current, 7)) return 'Next week';
    if (start === addDays(current, -7)) return 'Last week';
    const end = addDays(start, 6);
    return `${formatDay(start, { month: 'short', day: 'numeric' })} – ${formatDay(end, { month: 'short', day: 'numeric' })}`;
}

export function MealPlanScreen({ navigation }: TabScreenProps<'MealPlan'>) {
    const { colors } = useTheme();
    const meals = useTable('meal_plan_entries');
    const recipes = useTable('recipes');
    const editable = canEdit(useSession(s => s.role));
    const day = today();
    const thisWeek = startOfWeek(day, WEEK_STARTS_ON);
    const [weekStart, setWeekStart] = useState(thisWeek);
    const [target, setTarget] = useState<PlanTarget | null>(null);
    const [menuFor, setMenuFor] = useState<MealPlanEntry | null>(null);
    const [shopping, setShopping] = useState(false);

    const dates = useMemo(() => weekDates(weekStart), [weekStart]);
    const recipeById = useMemo(() => new Map(recipes.map(r => [r.id, r])), [recipes]);
    const byDate = useMemo(() => {
        const map = new Map<string, MealPlanEntry[]>();
        for (const m of meals) {
            if (m.date < dates[0] || m.date > dates[6]) continue;
            map.set(m.date, [...(map.get(m.date) ?? []), m]);
        }
        for (const list of map.values()) list.sort((a, b) => MEAL_ORDER[a.mealType] - MEAL_ORDER[b.mealType] || a.createdAt.localeCompare(b.createdAt));
        return map;
    }, [meals, dates]);

    // Shop for what's still ahead: skip days that are already over.
    const upcoming = useMemo(() => meals.filter(m => m.date >= dates[0] && m.date <= dates[6] && m.date >= day), [meals, dates, day]);
    const planned = useMemo(() => plannedRecipes(upcoming), [upcoming]);
    const weekCount = dates.reduce((n, d) => n + (byDate.get(d)?.length ?? 0), 0);

    const title = (m: MealPlanEntry) => (m.recipeId ? recipeById.get(m.recipeId)?.title : null) ?? m.title ?? 'Meal';

    const remove = (m: MealPlanEntry) => {
        removeMeal(m.id);
        toast(`Removed ${title(m)}`, { actionLabel: 'Undo', onAction: () => restoreMeal(m.id) });
    };

    const copyFromLastWeek = () => {
        const from = addDays(weekStart, -7);
        const source = meals.filter(m => m.date >= from && m.date < weekStart);
        if (!source.length) {
            toast('Nothing was planned the week before.', { tone: 'info' });
            return;
        }
        for (const m of source) planMeal({ date: addDays(m.date, 7), mealType: m.mealType, recipeId: m.recipeId, title: m.title, servings: m.servings });
        toast(`Copied ${source.length} meal${source.length === 1 ? '' : 's'} from the week before.`, { tone: 'success' });
    };

    return (
        <TabScreen title="Meal Plan">
            <View style={styles.weekBar}>
                <IconButton icon="chevron-back" label="Previous week" onPress={() => setWeekStart(addDays(weekStart, -7))} filled />
                <Pressable
                    style={styles.weekTitle}
                    onPress={() => setWeekStart(thisWeek)}
                    disabled={weekStart === thisWeek}
                    accessibilityRole="button"
                    accessibilityHint={weekStart === thisWeek ? undefined : 'Jump back to this week'}
                >
                    <Text variant="subheading">{weekLabel(weekStart, thisWeek)}</Text>
                    <Text variant="caption" muted>
                        {weekCount ? `${weekCount} meal${weekCount === 1 ? '' : 's'} planned` : 'Nothing planned yet'}
                    </Text>
                </Pressable>
                <IconButton icon="chevron-forward" label="Next week" onPress={() => setWeekStart(addDays(weekStart, 7))} filled />
            </View>

            {editable ? (
                <View style={styles.actions}>
                    <Button
                        title={planned.length ? `Shop for ${planned.length} recipe${planned.length === 1 ? '' : 's'}` : 'Shopping list'}
                        icon="cart-outline"
                        small
                        disabled={!planned.length}
                        onPress={() => setShopping(true)}
                        style={{ flex: 1 }}
                    />
                    {weekCount === 0 ? <Button title="Copy last week" icon="copy-outline" small variant="secondary" onPress={copyFromLastWeek} style={{ flex: 1 }} /> : null}
                </View>
            ) : null}

            <View style={{ gap: spacing.md }}>
                {dates.map(d => {
                    const entries = byDate.get(d) ?? [];
                    const isToday = d === day;
                    const past = d < day;
                    return (
                        <Card key={d} style={[styles.day, isToday && { borderColor: colors.primary, borderWidth: 1.5 }, past && { opacity: 0.7 }]}>
                            <View style={styles.dayHeader}>
                                <Text variant="subheading" style={{ flex: 1 }}>
                                    {formatDay(d, { weekday: 'long' })}
                                    <Text variant="caption" muted>
                                        {'  '}
                                        {formatDay(d, { month: 'short', day: 'numeric' })}
                                    </Text>
                                </Text>
                                {isToday ? (
                                    <View style={[styles.todayBadge, { backgroundColor: colors.primary }]}>
                                        <Text variant="caption" color={colors.onPrimary} style={{ fontWeight: '700' }}>
                                            Today
                                        </Text>
                                    </View>
                                ) : null}
                                {editable ? <IconButton icon="add" label={`Plan a meal on ${formatDay(d)}`} onPress={() => setTarget({ date: d })} color={colors.primary} /> : null}
                            </View>
                            {entries.length === 0 ? (
                                editable && !past ? (
                                    <View style={styles.quickSlots}>
                                        {MEAL_TYPES.slice(0, 3).map(m => (
                                            <Pressable
                                                key={m.key}
                                                onPress={() => setTarget({ date: d, mealType: m.key })}
                                                accessibilityRole="button"
                                                accessibilityLabel={`Plan ${m.label.toLowerCase()} on ${formatDay(d)}`}
                                                style={({ pressed }) => [styles.slot, { borderColor: colors.border }, pressed && { backgroundColor: colors.surfaceAlt }]}
                                            >
                                                <Ionicons name={m.icon} size={14} color={colors.textMuted} />
                                                <Text variant="caption" muted>
                                                    {m.label}
                                                </Text>
                                            </Pressable>
                                        ))}
                                    </View>
                                ) : (
                                    <Text variant="caption" muted>
                                        Nothing planned
                                    </Text>
                                )
                            ) : (
                                entries.map(m => {
                                    const recipe = m.recipeId ? recipeById.get(m.recipeId) : undefined;
                                    return (
                                        <Pressable
                                            key={m.id}
                                            onPress={() => (recipe ? navigation.navigate('RecipeDetail', { recipeId: recipe.id }) : editable && setTarget({ entry: m }))}
                                            onLongPress={editable ? () => setMenuFor(m) : undefined}
                                            accessibilityRole="button"
                                            accessibilityLabel={`${MEAL_LABEL[m.mealType]}: ${title(m)}`}
                                            style={({ pressed }) => [styles.entry, pressed && { opacity: 0.7 }]}
                                        >
                                            {recipe ? (
                                                <RecipeImage recipe={recipe} style={styles.entryThumb} />
                                            ) : (
                                                <View style={[styles.entryThumb, styles.noteThumb, { backgroundColor: colors.accentSoft }]}>
                                                    <Ionicons name="create-outline" size={18} color={colors.accent} />
                                                </View>
                                            )}
                                            <View style={{ flex: 1 }}>
                                                <Text variant="caption" muted style={{ fontWeight: '600' }}>
                                                    {MEAL_LABEL[m.mealType]}
                                                    {recipe && m.servings ? ` · ${m.servings} serving${m.servings === 1 ? '' : 's'}` : ''}
                                                </Text>
                                                <Text numberOfLines={1}>{title(m)}</Text>
                                            </View>
                                            {editable ? (
                                                <IconButton icon="ellipsis-horizontal" label={`Options for ${title(m)}`} onPress={() => setMenuFor(m)} color={colors.textMuted} />
                                            ) : null}
                                        </Pressable>
                                    );
                                })
                            )}
                        </Card>
                    );
                })}
            </View>

            <PlanMealSheet target={target} onClose={() => setTarget(null)} dates={dates} />
            <AddToListSheet
                visible={shopping}
                onClose={() => setShopping(false)}
                planned={planned}
                onAdded={listId => navigation.navigate('ListDetail', { listId })}
            />
            <ActionSheet
                visible={!!menuFor}
                onClose={() => setMenuFor(null)}
                title={menuFor ? title(menuFor) : ''}
                actions={
                    menuFor
                        ? [
                              ...(menuFor.recipeId ? [{ label: 'Open recipe', icon: 'book-outline' as const, onPress: () => navigation.navigate('RecipeDetail', { recipeId: menuFor.recipeId! }) }] : []),
                              { label: 'Change day, meal or servings', icon: 'swap-horizontal' as const, onPress: () => setTarget({ entry: menuFor }) },
                              { label: 'Remove from plan', icon: 'trash-outline' as const, destructive: true, onPress: () => remove(menuFor) },
                          ]
                        : []
                }
            />
        </TabScreen>
    );
}

const styles = StyleSheet.create({
    weekBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    weekTitle: { flex: 1, alignItems: 'center' },
    actions: { flexDirection: 'row', gap: spacing.sm },
    day: { gap: spacing.sm, paddingVertical: spacing.md },
    dayHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginRight: -spacing.sm },
    todayBadge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.pill },
    quickSlots: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
    slot: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderRadius: radius.pill,
        paddingHorizontal: spacing.md,
        paddingVertical: 6,
    },
    entry: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    entryThumb: { width: 44, height: 44, borderRadius: radius.sm },
    noteThumb: { alignItems: 'center', justifyContent: 'center' },
});
