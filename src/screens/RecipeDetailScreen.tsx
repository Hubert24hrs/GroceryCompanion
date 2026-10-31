import { Ionicons } from '@expo/vector-icons';
import React, { useLayoutEffect, useMemo, useState } from 'react';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RootScreenProps } from '../navigation/navigation';
import { deleteRecipe, previewIngredients, toggleFavorite } from '../data/repo';
import { NeedStatus } from '../domain/aggregate';
import { formatQuantity } from '../domain/units';
import { canEdit } from '../domain/validation';
import { useRecord, useTable } from '../state/hooks';
import { hasFeature } from '../domain/entitlements';
import { useIsPro, useSession } from '../state/session';
import { toastError } from '../state/toast';
import { Button, Card, EmptyState, IconButton, IconName, tap, Text } from '../ui/primitives';
import { layout } from '../ui/Screen';
import { ActionSheet, ConfirmSheet } from '../ui/Sheet';
import { radius, spacing, useTheme } from '../ui/theme';
import { defaultMealType } from './mealplan/mealUi';
import { PlanMealSheet, PlanTarget } from './mealplan/PlanMealSheet';
import { AddToListSheet } from './recipes/AddToListSheet';
import { RecipeImage } from './recipes/RecipeImage';
import { formatMinutes } from './recipes/recipeUi';

const STATUS: Partial<Record<NeedStatus, { icon: IconName; label: string }>> = {
    'in-pantry': { icon: 'checkmark-circle', label: 'In pantry' },
    partial: { icon: 'remove-circle-outline', label: 'Some in pantry' },
};

export function RecipeDetailScreen({ route, navigation }: RootScreenProps<'RecipeDetail'>) {
    const { recipeId } = route.params;
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const recipe = useRecord('recipes', recipeId);
    const pantry = useTable('pantry_items');
    const editable = canEdit(useSession(s => s.role));
    const isPro = useIsPro();
    const [servings, setServings] = useState<number | null>(null);
    const [menuOpen, setMenuOpen] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [addOpen, setAddOpen] = useState(false);
    const [planTarget, setPlanTarget] = useState<PlanTarget | null>(null);

    const portions = servings ?? recipe?.servings ?? 1;
    const planned = useMemo(() => (recipe ? [{ recipe, servings: portions }] : []), [recipe, portions]);
    const lines = useMemo(
        () => previewIngredients(planned, null),
        // Pantry changes alter the "in pantry" marks.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [planned, pantry],
    );

    useLayoutEffect(() => {
        navigation.setOptions({
            title: recipe?.title ?? 'Recipe',
            headerRight: () =>
                recipe && editable ? (
                    <View style={{ flexDirection: 'row' }}>
                        <IconButton
                            icon={recipe.isFavorite ? 'heart' : 'heart-outline'}
                            label={recipe.isFavorite ? 'Remove from favourites' : 'Add to favourites'}
                            color={recipe.isFavorite ? colors.danger : colors.primary}
                            onPress={() => {
                                tap();
                                toggleFavorite(recipe.id);
                            }}
                        />
                        <IconButton icon="ellipsis-horizontal-circle" label="Recipe options" color={colors.primary} onPress={() => setMenuOpen(true)} />
                    </View>
                ) : null,
        });
    }, [navigation, recipe, editable, colors]);

    if (!recipe) {
        return (
            <View style={[styles.root, { backgroundColor: colors.background }]}>
                <EmptyState icon="trash-outline" title="This recipe is gone" message="It may have been deleted on another device." action="Back" onAction={() => navigation.goBack()} />
            </View>
        );
    }

    const stats: { icon: IconName; label: string }[] = [
        recipe.prepMinutes ? { icon: 'cut-outline', label: `Prep ${formatMinutes(recipe.prepMinutes)}` } : null,
        recipe.cookMinutes ? { icon: 'flame-outline', label: `Cook ${formatMinutes(recipe.cookMinutes)}` } : null,
        recipe.calories ? { icon: 'nutrition-outline', label: `${recipe.calories} kcal / serving` } : null,
    ].filter((s): s is { icon: IconName; label: string } => !!s);
    const inPantry = lines.filter(l => l.status === 'in-pantry').length;
    // Meal planning is Pro; free users go to the Pro screen instead.
    const planThis = () => (isPro ? setPlanTarget({ recipeId: recipe.id, mealType: defaultMealType() }) : navigation.navigate('Pro'));
    const tags = recipe.tags.filter(t => t.toLowerCase() !== recipe.collection?.toLowerCase());

    return (
        <View style={[styles.root, { backgroundColor: colors.background }]}>
            <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 110 }]}>
                <RecipeImage recipe={recipe} style={styles.hero} />
                <View style={{ gap: spacing.sm }}>
                    <Text variant="title" accessibilityRole="header">
                        {recipe.title}
                    </Text>
                    {recipe.description ? <Text muted>{recipe.description}</Text> : null}
                    {stats.length ? (
                        <View style={styles.stats}>
                            {stats.map(s => (
                                <View key={s.label} style={styles.stat}>
                                    <Ionicons name={s.icon} size={16} color={colors.textMuted} />
                                    <Text variant="caption" muted>
                                        {s.label}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    ) : null}
                    {tags.length || recipe.collection ? (
                        <View style={styles.tags}>
                            {recipe.collection ? (
                                <View style={[styles.tag, { backgroundColor: colors.primarySoft }]}>
                                    <Text variant="caption" color={colors.primary} style={{ fontWeight: '600' }}>
                                        {recipe.collection}
                                    </Text>
                                </View>
                            ) : null}
                            {tags.map(t => (
                                <View key={t} style={[styles.tag, { backgroundColor: colors.surfaceAlt }]}>
                                    <Text variant="caption" muted>
                                        {t.replace(/-/g, ' ')}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    ) : null}
                </View>

                <Card style={{ gap: spacing.md }}>
                    <View style={styles.ingredientsHeader}>
                        <View style={{ flex: 1 }}>
                            <Text variant="heading">Ingredients</Text>
                            {inPantry ? (
                                <Text variant="caption" color={colors.primary}>
                                    {inPantry} of {lines.length} in your pantry
                                </Text>
                            ) : null}
                        </View>
                        <View style={[styles.stepper, { backgroundColor: colors.surfaceAlt }]}>
                            <IconButton icon="remove" size={18} label="Fewer servings" onPress={() => setServings(Math.max(1, portions - 1))} disabled={portions <= 1} />
                            <Text variant="label" accessibilityLabel={`${portions} servings`}>
                                {portions} serving{portions === 1 ? '' : 's'}
                            </Text>
                            <IconButton icon="add" size={18} label="More servings" onPress={() => setServings(Math.min(50, portions + 1))} />
                        </View>
                    </View>
                    {lines.length === 0 ? <Text muted>No ingredients listed.</Text> : null}
                    {lines.map(l => {
                        const status = STATUS[l.status];
                        return (
                            <View key={l.key} style={styles.ingredient}>
                                <Text variant="label" style={styles.qty} numberOfLines={1}>
                                    {formatQuantity(l.requiredQuantity, l.unit)}
                                </Text>
                                <Text style={{ flex: 1 }}>{l.name}</Text>
                                {status ? (
                                    <View style={styles.status} accessibilityLabel={status.label}>
                                        <Ionicons name={status.icon} size={16} color={colors.primary} />
                                        <Text variant="caption" color={colors.primary}>
                                            {status.label}
                                        </Text>
                                    </View>
                                ) : null}
                            </View>
                        );
                    })}
                </Card>

                {recipe.instructions.length ? (
                    <Card style={{ gap: spacing.lg }}>
                        <Text variant="heading">Method</Text>
                        {recipe.instructions.map((step, i) => (
                            <View key={i} style={styles.step}>
                                <View style={[styles.stepNumber, { backgroundColor: colors.accentSoft }]}>
                                    <Text variant="label" color={colors.accent}>
                                        {i + 1}
                                    </Text>
                                </View>
                                <Text style={{ flex: 1, lineHeight: 23 }}>{step}</Text>
                            </View>
                        ))}
                    </Card>
                ) : null}

                {recipe.sourceUrl ? (
                    <Button
                        title={`View original${recipe.sourceName ? ` on ${recipe.sourceName}` : ''}`}
                        icon="open-outline"
                        variant="ghost"
                        onPress={() => void Linking.openURL(recipe.sourceUrl!).catch(toastError)}
                    />
                ) : null}
            </ScrollView>

            {editable && lines.length ? (
                <View style={[styles.bottomBar, { paddingBottom: insets.bottom + spacing.md, backgroundColor: colors.surface, borderTopColor: colors.border }]}>
                    <View style={layout.page}>
                        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                            <Button
                                title="Plan"
                                icon="calendar-outline"
                                variant="secondary"
                                onPress={() => planThis()}
                            />
                            <Button title="Add ingredients to a list" icon="cart-outline" onPress={() => (hasFeature(isPro, 'recipeToList') ? setAddOpen(true) : navigation.navigate('Pro'))} style={{ flex: 1 }} />
                        </View>
                    </View>
                </View>
            ) : null}

            <AddToListSheet
                visible={addOpen}
                onClose={() => setAddOpen(false)}
                planned={planned}
                onAdded={listId => navigation.navigate('ListDetail', { listId })}
            />
            <PlanMealSheet target={planTarget} onClose={() => setPlanTarget(null)} />
            <ActionSheet
                visible={menuOpen}
                onClose={() => setMenuOpen(false)}
                title={recipe.title}
                actions={[
                    { label: 'Plan this meal', icon: 'calendar-outline', onPress: () => planThis() },
                    { label: 'Edit recipe', icon: 'create-outline', onPress: () => navigation.navigate('RecipeEdit', { recipeId: recipe.id }) },
                    { label: 'Delete recipe', icon: 'trash-outline', destructive: true, onPress: () => setConfirmDelete(true) },
                ]}
            />
            <ConfirmSheet
                visible={confirmDelete}
                onClose={() => setConfirmDelete(false)}
                title="Delete recipe?"
                message={`“${recipe.title}” will be removed from your household's recipe box. Planned meals keep their name.`}
                confirmLabel="Delete"
                onConfirm={() => {
                    navigation.goBack();
                    deleteRecipe(recipe.id).catch(toastError);
                }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1 },
    content: { padding: spacing.lg, gap: spacing.xl, ...layout.page },
    hero: { width: '100%', aspectRatio: 16 / 9, borderRadius: radius.lg },
    stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
    stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    tag: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.pill },
    ingredientsHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flexWrap: 'wrap' },
    stepper: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.pill, gap: 2 },
    ingredient: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 28 },
    qty: { width: 76 },
    status: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    step: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
    stepNumber: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: spacing.lg, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth },
});
