import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { DimensionValue, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { TabScreenProps } from '../navigation/navigation';
import { toggleFavorite } from '../data/repo';
import { latestUnitPrices } from '../domain/analytics';
import { addDays, today } from '../domain/dates';
import { canAddRecipe, FREE_LIMITS, hasFeature } from '../domain/entitlements';
import { itemKey } from '../domain/pantry';
import { suggestMeals } from '../domain/suggestions';
import { Recipe } from '../domain/types';
import { canEdit } from '../domain/validation';
import { useTable } from '../state/hooks';
import { usePrefs } from '../state/prefs';
import { useIsPro, useSession } from '../state/session';
import { toast } from '../state/toast';
import { Button, Card, Chip, EmptyState, Field, SectionTitle, tap, Text } from '../ui/primitives';
import { TabScreen } from '../ui/Screen';
import { radius, spacing, useTheme } from '../ui/theme';
import { RecipeImage } from './recipes/RecipeImage';
import { formatMinutes, totalMinutes } from './recipes/recipeUi';

type Filter = 'all' | 'favorites' | 'quick' | `collection:${string}`;

function RecipeCard({ recipe, width, onPress, onFavorite }: { recipe: Recipe; width: DimensionValue; onPress: () => void; onFavorite?: () => void }) {
    const { colors } = useTheme();
    const minutes = totalMinutes(recipe);
    // The heart sits beside the card's pressable, not inside it (nested buttons are invalid on web).
    return (
        <View style={{ width }}>
            <Pressable
                onPress={onPress}
                accessibilityRole="button"
                accessibilityLabel={`${recipe.title}${minutes ? `, ${formatMinutes(minutes)}` : ''}`}
                style={({ pressed }) => [styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && { opacity: 0.85 }]}
            >
                <RecipeImage recipe={recipe} style={styles.cardImage} />
                <View style={styles.cardBody}>
                    <Text variant="label" numberOfLines={2} style={{ fontSize: 15 }}>
                        {recipe.title}
                    </Text>
                    <Text variant="caption" muted numberOfLines={1}>
                        {[minutes ? formatMinutes(minutes) : null, `${recipe.servings} serving${recipe.servings === 1 ? '' : 's'}`].filter(Boolean).join(' · ')}
                    </Text>
                </View>
            </Pressable>
            {onFavorite ? (
                <Pressable
                    onPress={onFavorite}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={recipe.isFavorite ? `Remove ${recipe.title} from favourites` : `Add ${recipe.title} to favourites`}
                    style={[styles.heart, { backgroundColor: colors.surface }]}
                >
                    <Ionicons name={recipe.isFavorite ? 'heart' : 'heart-outline'} size={18} color={recipe.isFavorite ? colors.danger : colors.textMuted} />
                </Pressable>
            ) : null}
        </View>
    );
}

export function RecipesScreen({ navigation }: TabScreenProps<'Recipes'>) {
    const { colors } = useTheme();
    const [gridWidth, setGridWidth] = useState(0);
    const recipes = useTable('recipes');
    const pantry = useTable('pantry_items');
    const meals = useTable('meal_plan_entries');
    const purchases = useTable('purchases');
    const prefs = usePrefs(s => s.prefs);
    const isPro = useIsPro();
    const editable = canEdit(useSession(s => s.role));
    const [query, setQuery] = useState('');
    const [filter, setFilter] = useState<Filter>('all');

    const day = today();
    const collections = useMemo(
        () => [...new Set(recipes.map(r => r.collection).filter((c): c is string => !!c))].sort((a, b) => a.localeCompare(b)),
        [recipes],
    );

    const suggestions = useMemo(() => {
        const recentlyPlanned = new Set(meals.filter(m => m.recipeId && m.date >= addDays(day, -7)).map(m => m.recipeId!));
        return suggestMeals(recipes, pantry, prefs, day, { unitPrices: latestUnitPrices(purchases), recentlyPlanned, limit: 5 }).filter(
            s => s.coverage > 0 || s.usesExpiring.length,
        );
    }, [recipes, pantry, prefs, day, meals, purchases]);

    const shown = useMemo(() => {
        const q = itemKey(query);
        return recipes
            .filter(r => {
                if (filter === 'favorites' && !r.isFavorite) return false;
                if (filter === 'quick' && !(totalMinutes(r) > 0 && totalMinutes(r) <= 30)) return false;
                if (filter.startsWith('collection:') && r.collection !== filter.slice(11)) return false;
                if (!q) return true;
                return (
                    itemKey(r.title).includes(q) ||
                    r.tags.some(t => t.toLowerCase().includes(q)) ||
                    r.ingredients.some(i => itemKey(i.name).includes(q))
                );
            })
            .sort((a, b) => Number(b.isFavorite) - Number(a.isFavorite) || a.title.localeCompare(b.title));
    }, [recipes, query, filter]);

    const open = (r: Recipe) => navigation.navigate('RecipeDetail', { recipeId: r.id });
    const newRecipe = () => {
        if (!canAddRecipe(isPro, recipes.length)) {
            toast(`The free recipe box holds ${FREE_LIMITS.recipes} recipes. Delete one or upgrade to Pro for unlimited recipes.`, { tone: 'warning', actionLabel: 'See Pro', onAction: () => navigation.navigate('Pro') });
            return;
        }
        navigation.navigate('RecipeEdit', {});
    };

    // Two columns on phones, three on wide screens. Measured, because scrollbars eat into the window width on web.
    const columns = gridWidth > 560 ? 3 : 2;
    const cardWidth = gridWidth ? Math.floor((gridWidth - spacing.md * (columns - 1)) / columns) : '47%';
    const smartAllowed = hasFeature(isPro, 'smartSuggestions');

    return (
        <TabScreen title="Recipes" right={editable ? <Button title="New" icon="add" small onPress={newRecipe} /> : null}>
            {suggestions.length > 0 && !query && filter === 'all' ? (
                <View>
                    <SectionTitle title="Cook from your pantry" />
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md, paddingRight: spacing.lg }}>
                        {suggestions.slice(0, smartAllowed ? 5 : 1).map(s => (
                            <Card key={s.recipe.id} onPress={() => open(s.recipe)} style={styles.suggestion} accessibilityLabel={`${s.recipe.title}. ${s.reasons.join('. ')}`}>
                                <RecipeImage recipe={s.recipe} style={styles.suggestionImage} />
                                <View style={{ flex: 1, gap: 4 }}>
                                    <Text variant="label" numberOfLines={2}>
                                        {s.recipe.title}
                                    </Text>
                                    <Text variant="caption" color={colors.primary} numberOfLines={2}>
                                        {s.reasons[0] ?? `${Math.round(s.coverage * 100)}% in your pantry`}
                                    </Text>
                                    {s.missing.length ? (
                                        <Text variant="caption" muted numberOfLines={1}>
                                            Need {s.missing.slice(0, 3).map(m => m.name.toLowerCase()).join(', ')}
                                            {s.missing.length > 3 ? ` +${s.missing.length - 3}` : ''}
                                        </Text>
                                    ) : null}
                                </View>
                            </Card>
                        ))}
                        {!smartAllowed && suggestions.length > 1 ? (
                            <Card onPress={() => navigation.navigate('Pro')} accessibilityLabel="See Pro" style={[styles.suggestion, { backgroundColor: colors.accentSoft, borderColor: colors.accentSoft }]}>
                                <Ionicons name="sparkles" size={22} color={colors.accent} />
                                <Text variant="caption" style={{ flex: 1 }}>
                                    {suggestions.length - 1} more idea{suggestions.length === 2 ? '' : 's'} with Pro, ranked by pantry, expiry dates, diet and budget.
                                </Text>
                            </Card>
                        ) : null}
                    </ScrollView>
                </View>
            ) : null}

            <View style={{ gap: spacing.md }}>
                <Field value={query} onChangeText={setQuery} placeholder="Search recipes, tags or ingredients" accessibilityLabel="Search recipes" />
                <View style={styles.chips}>
                    <Chip label="All" selected={filter === 'all'} onPress={() => setFilter('all')} />
                    <Chip label="Favourites" icon="heart" selected={filter === 'favorites'} onPress={() => setFilter('favorites')} />
                    <Chip label="30 min or less" icon="time-outline" selected={filter === 'quick'} onPress={() => setFilter('quick')} />
                    {collections.map(c => (
                        <Chip key={c} label={c} icon="folder-outline" selected={filter === `collection:${c}`} onPress={() => setFilter(`collection:${c}`)} />
                    ))}
                </View>
            </View>

            {recipes.length === 0 ? (
                <Card>
                    <EmptyState
                        icon="book-outline"
                        title="Your recipe box is empty"
                        message="Save the meals you cook. Their ingredients go onto a list in one tap, minus what's in your pantry."
                        action={editable ? 'Add a recipe' : undefined}
                        onAction={newRecipe}
                    />
                </Card>
            ) : shown.length === 0 ? (
                <EmptyState icon="search" title="No recipes found" message={query ? `Nothing matches “${query}”.` : 'Nothing in this filter yet.'} />
            ) : (
                <View style={styles.grid} onLayout={e => setGridWidth(e.nativeEvent.layout.width)}>
                    {shown.map(r => (
                        <RecipeCard
                            key={r.id}
                            recipe={r}
                            width={cardWidth}
                            onPress={() => open(r)}
                            onFavorite={
                                editable
                                    ? () => {
                                          tap();
                                          toggleFavorite(r.id);
                                      }
                                    : undefined
                            }
                        />
                    ))}
                </View>
            )}
            {!isPro && recipes.length > 0 ? (
                <Text variant="caption" muted style={{ textAlign: 'center' }}>
                    {recipes.length} of {FREE_LIMITS.recipes} free recipes
                </Text>
            ) : null}
        </TabScreen>
    );
}

const styles = StyleSheet.create({
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
    card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
    cardImage: { width: '100%', aspectRatio: 4 / 3 },
    cardBody: { padding: spacing.md, gap: 4 },
    heart: { position: 'absolute', top: spacing.sm, right: spacing.sm, width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    suggestion: { width: 280, flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
    suggestionImage: { width: 64, height: 64, borderRadius: radius.md },
});
