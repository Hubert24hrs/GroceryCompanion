import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { planMeal, updateMeal } from '../../data/repo';
import { addDays, formatDay, today } from '../../domain/dates';
import { itemKey } from '../../domain/pantry';
import { suggestMeals } from '../../domain/suggestions';
import { MealPlanEntry, MealType } from '../../domain/types';
import { cleanText } from '../../domain/validation';
import { useTable } from '../../state/hooks';
import { usePrefs } from '../../state/prefs';
import { toast } from '../../state/toast';
import { Button, Chip, Field, IconButton, Text } from '../../ui/primitives';
import { Sheet } from '../../ui/Sheet';
import { radius, spacing, useTheme } from '../../ui/theme';
import { RecipeImage } from '../recipes/RecipeImage';
import { formatMinutes, totalMinutes } from '../recipes/recipeUi';
import { MEAL_TYPES } from './mealUi';

export interface PlanTarget {
    /** Editing an existing entry. */
    entry?: MealPlanEntry;
    date?: string;
    mealType?: MealType;
    recipeId?: string;
}

/** Put a recipe (or a free-text meal like "Leftovers") on a day and meal. */
export function PlanMealSheet({ target, onClose, dates }: { target: PlanTarget | null; onClose: () => void; dates?: string[] }) {
    const { colors } = useTheme();
    const recipes = useTable('recipes');
    const pantry = useTable('pantry_items');
    const prefs = usePrefs(s => s.prefs);
    const [date, setDate] = useState(today());
    const [mealType, setMealType] = useState<MealType>('dinner');
    const [recipeId, setRecipeId] = useState<string | null>(null);
    const [note, setNote] = useState('');
    const [servings, setServings] = useState(2);
    const [query, setQuery] = useState('');

    useEffect(() => {
        if (!target) return;
        const e = target.entry;
        setDate(e?.date ?? target.date ?? today());
        setMealType(e?.mealType ?? target.mealType ?? 'dinner');
        setRecipeId(e ? e.recipeId : target.recipeId ?? null);
        setNote(e?.recipeId ? '' : e?.title ?? '');
        setServings(e?.servings ?? prefs.householdSize);
        setQuery('');
    }, [target, prefs.householdSize]);

    // Pantry-friendly ideas first when not searching; otherwise filter by name.
    const options = useMemo(() => {
        if (!target) return [];
        const q = itemKey(query);
        if (q) return recipes.filter(r => itemKey(r.title).includes(q) || r.tags.some(t => t.toLowerCase().includes(q))).slice(0, 12);
        const ranked = suggestMeals(recipes, pantry, prefs, today(), { limit: recipes.length }).map(s => s.recipe);
        return [...ranked, ...recipes.filter(r => !ranked.includes(r))].slice(0, 12);
    }, [target, query, recipes, pantry, prefs]);

    if (!target) return null;
    const selected = recipeId ? recipes.find(r => r.id === recipeId) : undefined;
    const baseDays = dates ?? Array.from({ length: 7 }, (_, i) => addDays(today(), i));
    const dayChoices = baseDays.includes(date) ? baseDays : [date, ...baseDays];
    const canSave = !!selected || !!cleanText(note);

    const save = () => {
        if (!canSave) return;
        const fields = {
            date,
            mealType,
            recipeId: selected?.id ?? null,
            title: selected ? null : cleanText(note, 120),
            servings: selected ? servings : null,
        };
        if (target.entry) updateMeal(target.entry.id, fields);
        else planMeal(fields);
        onClose();
        toast(`${selected?.title ?? fields.title} planned for ${formatDay(date, { weekday: 'long' })}.`, { tone: 'success' });
    };

    return (
        <Sheet
            visible
            onClose={onClose}
            title={target.entry ? 'Change meal' : 'Plan a meal'}
            footer={<Button title={target.entry ? 'Save' : 'Add to plan'} icon="calendar" disabled={!canSave} onPress={save} />}
        >
            <View style={styles.group}>
                <View style={styles.chips}>
                    {dayChoices.map(d => (
                        <Chip
                            key={d}
                            label={d === today() ? 'Today' : formatDay(d, { weekday: 'short', day: 'numeric' })}
                            selected={d === date}
                            onPress={() => setDate(d)}
                        />
                    ))}
                </View>
                <View style={styles.chips}>
                    {MEAL_TYPES.map(m => (
                        <Chip key={m.key} label={m.label} icon={m.icon} selected={m.key === mealType} onPress={() => setMealType(m.key)} color={colors.accent} />
                    ))}
                </View>
            </View>

            {selected ? (
                <View style={[styles.selected, { backgroundColor: colors.primarySoft }]}>
                    <RecipeImage recipe={selected} style={styles.thumb} />
                    <View style={{ flex: 1, gap: 2 }}>
                        <Text variant="label" numberOfLines={2}>
                            {selected.title}
                        </Text>
                        <View style={styles.servings}>
                            <IconButton icon="remove" size={16} label="Fewer servings" onPress={() => setServings(Math.max(1, servings - 1))} disabled={servings <= 1} />
                            <Text variant="caption">
                                {servings} serving{servings === 1 ? '' : 's'}
                            </Text>
                            <IconButton icon="add" size={16} label="More servings" onPress={() => setServings(Math.min(50, servings + 1))} />
                        </View>
                    </View>
                    <IconButton icon="close-circle" label="Choose a different recipe" color={colors.textMuted} onPress={() => setRecipeId(null)} />
                </View>
            ) : (
                <>
                    <Field value={query} onChangeText={setQuery} placeholder="Search your recipes" accessibilityLabel="Search your recipes" />
                    <View style={[styles.options, { borderColor: colors.border }]}>
                        {options.length === 0 ? (
                            <Text variant="caption" muted style={{ padding: spacing.md }}>
                                {recipes.length ? 'No recipes match.' : 'Your recipe box is empty. Add a note below instead.'}
                            </Text>
                        ) : null}
                        {options.map(r => {
                            const minutes = totalMinutes(r);
                            return (
                                <Pressable
                                    key={r.id}
                                    onPress={() => {
                                        setRecipeId(r.id);
                                        setNote('');
                                    }}
                                    accessibilityRole="button"
                                    accessibilityLabel={`Choose ${r.title}`}
                                    style={({ pressed }) => [styles.option, { borderBottomColor: colors.border }, pressed && { backgroundColor: colors.surfaceAlt }]}
                                >
                                    <RecipeImage recipe={r} style={styles.optionThumb} />
                                    <View style={{ flex: 1 }}>
                                        <Text numberOfLines={1}>{r.title}</Text>
                                        <Text variant="caption" muted numberOfLines={1}>
                                            {[minutes ? formatMinutes(minutes) : null, r.isFavorite ? 'Favourite' : null].filter(Boolean).join(' · ') || ' '}
                                        </Text>
                                    </View>
                                    <Ionicons name="add-circle-outline" size={22} color={colors.primary} />
                                </Pressable>
                            );
                        })}
                    </View>
                    <Field
                        label="Or just a note"
                        value={note}
                        onChangeText={setNote}
                        placeholder="Leftovers, eating out, pizza night…"
                        returnKeyType="done"
                        onSubmitEditing={save}
                    />
                </>
            )}
        </Sheet>
    );
}

const styles = StyleSheet.create({
    group: { gap: spacing.sm },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    selected: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.md },
    thumb: { width: 56, height: 56, borderRadius: radius.sm },
    servings: { flexDirection: 'row', alignItems: 'center', gap: 2, marginLeft: -8 },
    options: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md, overflow: 'hidden' },
    option: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth },
    optionThumb: { width: 40, height: 40, borderRadius: radius.sm },
});
