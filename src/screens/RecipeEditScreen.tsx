import React, { useLayoutEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RootScreenProps } from '../navigation/navigation';
import { createRecipe, ingredientsToLines, parseIngredientLines, updateRecipe } from '../data/repo';
import { getDb } from '../data/db';
import { CATEGORIES } from '../domain/categories';
import { canAddRecipe, FREE_LIMITS } from '../domain/entitlements';
import { formatQuantity } from '../domain/units';
import { cleanText, hostOf, parseMoney, parseOptionalNumber, validateName, validateUrl } from '../domain/validation';
import { useRecord, useTable } from '../state/hooks';
import { useIsPro } from '../state/session';
import { toast } from '../state/toast';
import { Button, Card, Chip, Field, Text } from '../ui/primitives';
import { layout } from '../ui/Screen';
import { radius, spacing, useTheme } from '../ui/theme';

type Errors = Partial<Record<'title' | 'servings' | 'prep' | 'cook' | 'calories' | 'cost' | 'image' | 'source' | 'ingredients', string>>;

const numberText = (n: number | null | undefined) => (n == null ? '' : String(n));

export function RecipeEditScreen({ route, navigation }: RootScreenProps<'RecipeEdit'>) {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const existing = useRecord('recipes', route.params.recipeId);
    const recipes = useTable('recipes');
    const isPro = useIsPro();

    // Initialised once from the recipe being edited; later remote edits don't clobber typing.
    const [title, setTitle] = useState(existing?.title ?? '');
    const [description, setDescription] = useState(existing?.description ?? '');
    const [servings, setServings] = useState(numberText(existing?.servings ?? 4));
    const [prep, setPrep] = useState(numberText(existing?.prepMinutes));
    const [cook, setCook] = useState(numberText(existing?.cookMinutes));
    const [calories, setCalories] = useState(numberText(existing?.calories));
    const [cost, setCost] = useState(numberText(existing?.estimatedCost));
    const [ingredients, setIngredients] = useState(existing ? ingredientsToLines(existing.ingredients) : '');
    const [instructions, setInstructions] = useState(existing?.instructions.join('\n') ?? '');
    const [tags, setTags] = useState(existing?.tags.join(', ') ?? '');
    const [collection, setCollection] = useState(existing?.collection ?? '');
    const [imageUrl, setImageUrl] = useState(existing?.imageUrl ?? '');
    const [sourceUrl, setSourceUrl] = useState(existing?.sourceUrl ?? '');
    const [errors, setErrors] = useState<Errors>({});

    const parsed = useMemo(() => parseIngredientLines(ingredients), [ingredients]);
    const collections = useMemo(
        () => [...new Set(recipes.map(r => r.collection).filter((c): c is string => !!c))].sort((a, b) => a.localeCompare(b)),
        [recipes],
    );

    const save = () => {
        const t = validateName(title, 'Title', 120);
        const s = parseOptionalNumber(servings, 'Servings', 100);
        const p = parseOptionalNumber(prep, 'Prep time', 10_000);
        const c = parseOptionalNumber(cook, 'Cook time', 10_000);
        const k = parseOptionalNumber(calories, 'Calories', 20_000);
        const m = parseMoney(cost, 'Cost');
        const img = validateUrl(imageUrl);
        const src = validateUrl(sourceUrl);
        const next: Errors = {
            title: t.ok ? undefined : t.error,
            servings: !s.ok ? s.error : !s.value || s.value < 1 ? 'Servings must be at least 1.' : undefined,
            prep: p.ok ? undefined : p.error,
            cook: c.ok ? undefined : c.error,
            calories: k.ok ? undefined : k.error,
            cost: m.ok ? undefined : m.error,
            image: img.ok ? undefined : img.error,
            source: src.ok ? undefined : src.error,
            ingredients: parsed.length ? undefined : 'Add at least one ingredient.',
        };
        setErrors(next);
        if (Object.values(next).some(Boolean) || !t.ok || !s.ok || !p.ok || !c.ok || !k.ok || !m.ok || !img.ok || !src.ok) {
            toast('Check the highlighted fields.', { tone: 'warning' });
            return;
        }
        const fields = {
            title: t.value,
            description: cleanText(description, 1000) || null,
            servings: Math.max(1, Math.round(s.value ?? 1)),
            prepMinutes: p.value == null ? null : Math.round(p.value),
            cookMinutes: c.value == null ? null : Math.round(c.value),
            calories: k.value == null ? null : Math.round(k.value),
            estimatedCost: m.value,
            ingredients: parsed,
            instructions: instructions.split('\n').map(l => cleanText(l, 2000)).filter(Boolean),
            tags: [...new Set(tags.split(',').map(x => cleanText(x, 30)).filter(Boolean))],
            collection: cleanText(collection, 60) || null,
            imageUrl: img.value,
            sourceUrl: src.value,
        };
        if (existing) {
            updateRecipe(existing.id, fields);
            navigation.goBack();
        } else {
            // The free recipe limit, checked against live data at save time.
            if (!canAddRecipe(isPro, getDb().list('recipes').length)) {
                toast(`The free recipe box holds ${FREE_LIMITS.recipes} recipes.`, { tone: 'warning', actionLabel: 'See Pro', onAction: () => navigation.navigate('Pro') });
                return;
            }
            const created = createRecipe({
                ...fields,
                sourceName: src.value ? hostOf(src.value) : null,
                isFavorite: false,
            });
            navigation.replace('RecipeDetail', { recipeId: created.id });
        }
        toast(existing ? 'Recipe saved.' : 'Recipe added.', { tone: 'success' });
    };

    useLayoutEffect(() => {
        navigation.setOptions({
            title: existing ? 'Edit recipe' : 'New recipe',
            headerRight: () => <Button title="Save" small onPress={save} />,
        });
    });

    return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.root, { backgroundColor: colors.background }]}>
            <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]} keyboardShouldPersistTaps="handled">
                <Field label="Title" value={title} onChangeText={setTitle} placeholder="e.g. Lemon herb chicken" autoFocus={!existing} error={errors.title} />
                <Field
                    label="Description"
                    value={description}
                    onChangeText={setDescription}
                    placeholder="A line about the dish (optional)"
                    multiline
                    style={styles.multiline}
                />
                <View style={styles.row}>
                    <View style={styles.cell}>
                        <Field label="Servings" value={servings} onChangeText={setServings} keyboardType="number-pad" error={errors.servings} />
                    </View>
                    <View style={styles.cell}>
                        <Field label="Prep (min)" value={prep} onChangeText={setPrep} keyboardType="number-pad" error={errors.prep} />
                    </View>
                    <View style={styles.cell}>
                        <Field label="Cook (min)" value={cook} onChangeText={setCook} keyboardType="number-pad" error={errors.cook} />
                    </View>
                </View>

                <View style={{ gap: spacing.sm }}>
                    <Field
                        label="Ingredients — one per line"
                        value={ingredients}
                        onChangeText={setIngredients}
                        placeholder={'500 g spaghetti\n2 cloves garlic, minced\n1 can chopped tomatoes'}
                        multiline
                        autoCapitalize="none"
                        style={[styles.multiline, { minHeight: 150 }]}
                        error={errors.ingredients}
                    />
                    {parsed.length ? (
                        <Card style={{ padding: spacing.md, gap: 6 }}>
                            <Text variant="caption" muted>
                                We read {parsed.length} ingredient{parsed.length === 1 ? '' : 's'}:
                            </Text>
                            {parsed.map((p, i) => (
                                <View key={i} style={styles.parsed}>
                                    <View style={[styles.dot, { backgroundColor: CATEGORIES[p.category].color }]} />
                                    <Text variant="caption" style={{ width: 70 }} muted>
                                        {formatQuantity(p.quantity, p.unit)}
                                    </Text>
                                    <Text variant="caption" style={{ flex: 1 }} numberOfLines={1}>
                                        {p.name}
                                        {p.note ? ` (${p.note})` : ''}
                                    </Text>
                                    <Text variant="caption" muted>
                                        {CATEGORIES[p.category].label}
                                    </Text>
                                </View>
                            ))}
                        </Card>
                    ) : null}
                </View>

                <Field
                    label="Method — one step per line"
                    value={instructions}
                    onChangeText={setInstructions}
                    placeholder={'Boil the pasta.\nFry the garlic in olive oil…'}
                    multiline
                    style={[styles.multiline, { minHeight: 150 }]}
                />

                <View style={{ gap: spacing.sm }}>
                    <Field label="Collection" value={collection} onChangeText={setCollection} placeholder="e.g. Weeknight dinners" />
                    {collections.length ? (
                        <View style={styles.chips}>
                            {collections.map(c => (
                                <Chip key={c} label={c} icon="folder-outline" selected={collection === c} onPress={() => setCollection(collection === c ? '' : c)} />
                            ))}
                        </View>
                    ) : null}
                </View>
                <Field label="Tags — comma separated" value={tags} onChangeText={setTags} placeholder="Vegetarian, Quick, Freezer-friendly" />
                <View style={styles.row}>
                    <View style={styles.cell}>
                        <Field label="Calories / serving" value={calories} onChangeText={setCalories} keyboardType="number-pad" error={errors.calories} />
                    </View>
                    <View style={styles.cell}>
                        <Field label="Est. cost (whole recipe)" value={cost} onChangeText={setCost} keyboardType="decimal-pad" placeholder="0.00" error={errors.cost} />
                    </View>
                </View>
                <Field label="Photo link" value={imageUrl} onChangeText={setImageUrl} placeholder="https://…" autoCapitalize="none" keyboardType="url" error={errors.image} />
                <Field label="Original recipe link" value={sourceUrl} onChangeText={setSourceUrl} placeholder="https://…" autoCapitalize="none" keyboardType="url" error={errors.source} />
                <Button title={existing ? 'Save recipe' : 'Add recipe'} icon="checkmark" onPress={save} />
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1 },
    content: { padding: spacing.lg, gap: spacing.lg, ...layout.page },
    multiline: { minHeight: 80, paddingTop: 12, textAlignVertical: 'top' },
    row: { flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap' },
    cell: { flex: 1, minWidth: 100 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    parsed: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    dot: { width: 8, height: 8, borderRadius: radius.pill },
});
