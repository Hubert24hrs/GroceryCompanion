import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { addIngredientsToList, createList, previewIngredients } from '../../data/repo';
import { NeededIngredient, PlannedRecipe } from '../../domain/aggregate';
import { CATEGORIES, compareCategories } from '../../domain/categories';
import { formatQuantity } from '../../domain/units';
import { useTable } from '../../state/hooks';
import { toast, toastError } from '../../state/toast';
import { Button, Chip, Text } from '../../ui/primitives';
import { Sheet } from '../../ui/Sheet';
import { radius, spacing, useTheme } from '../../ui/theme';
import { LIST_COLORS } from '../lists/ListFormSheet';

const STATUS_NOTE: Record<NeededIngredient['status'], string | null> = {
    needed: null,
    partial: 'Some in pantry',
    'in-pantry': 'In pantry',
    'on-list': 'Already on list',
};

/**
 * How much to put on the list. A line the pantry fully covers has 0 left to
 * buy, so if it's ticked anyway use the full recipe amount. Counted items
 * (no unit) round up: nobody buys ⅓ of an onion.
 */
function toBuy(l: NeededIngredient): number | null {
    const qty = l.status === 'in-pantry' ? l.requiredQuantity : l.quantity;
    if (qty == null || (l.unit && l.unit !== 'pc')) return qty;
    return Math.max(1, Math.ceil(qty - 0.001));
}

/**
 * Review the ingredients of one or more recipes before they go on a list.
 * Lines the pantry or the list already covers start unticked.
 */
export function AddToListSheet({ visible, onClose, planned, onAdded }: {
    visible: boolean;
    onClose: () => void;
    planned: PlannedRecipe[];
    onAdded?: (listId: string) => void;
}) {
    const { colors } = useTheme();
    const lists = useTable('lists');
    const items = useTable('items');
    const pantry = useTable('pantry_items');
    const active = useMemo(
        () => lists.filter(l => !l.isArchived && !l.isTemplate).sort((a, b) => a.sortOrder - b.sortOrder),
        [lists],
    );
    const [listId, setListId] = useState<string | null>(null);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (visible && (!listId || !active.some(l => l.id === listId))) setListId(active[0]?.id ?? null);
    }, [visible, active, listId]);

    const lines = useMemo(
        () => (visible ? previewIngredients(planned, listId).sort((a, b) => compareCategories(a.category, b.category)) : []),
        // Recompute when the pantry or list contents change while open.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [visible, planned, listId, items, pantry],
    );

    // Default ticks when the sheet opens or the target list changes. Not on every
    // pantry/list update while open, or a sync would undo the user's choices.
    const latestLines = useRef(lines);
    latestLines.current = lines;
    useEffect(() => {
        if (visible) setSelected(new Set(latestLines.current.filter(l => l.status === 'needed' || l.status === 'partial').map(l => l.key)));
    }, [visible, listId, planned]);

    const toggle = (key: string) =>
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });

    const add = async () => {
        if (!listId) return;
        setSaving(true);
        try {
            const n = await addIngredientsToList(listId, lines.filter(l => selected.has(l.key)).map(l => ({ ...l, quantity: toBuy(l) })));
            const list = active.find(l => l.id === listId);
            onClose();
            toast(`Added ${n} item${n === 1 ? '' : 's'} to ${list?.name ?? 'your list'}.`, {
                tone: 'success',
                actionLabel: onAdded ? 'Open' : undefined,
                onAction: () => onAdded?.(listId),
            });
        } catch (e) {
            toastError(e);
        } finally {
            setSaving(false);
        }
    };

    const covered = lines.length - lines.filter(l => l.status === 'needed' || l.status === 'partial').length;

    return (
        <Sheet
            visible={visible}
            onClose={onClose}
            title="Add ingredients to a list"
            footer={
                active.length ? (
                    <Button
                        title={selected.size ? `Add ${selected.size} item${selected.size === 1 ? '' : 's'}` : 'Nothing selected'}
                        icon="cart-outline"
                        disabled={!selected.size}
                        loading={saving}
                        onPress={add}
                    />
                ) : null
            }
        >
            {active.length === 0 ? (
                <View style={{ gap: spacing.md }}>
                    <Text muted>You don’t have a shopping list yet.</Text>
                    <Button
                        title="Create “Groceries”"
                        icon="add"
                        onPress={() => setListId(createList({ name: 'Groceries', color: LIST_COLORS[0] }).id)}
                    />
                </View>
            ) : (
                <>
                    {active.length > 1 ? (
                        <View style={styles.chips}>
                            {active.map(l => (
                                <Chip key={l.id} label={l.name} color={l.color} selected={l.id === listId} onPress={() => setListId(l.id)} />
                            ))}
                        </View>
                    ) : (
                        <Text variant="caption" muted>
                            Adding to {active[0].name}
                        </Text>
                    )}
                    {covered > 0 ? (
                        <Text variant="caption" muted>
                            {covered} ingredient{covered === 1 ? ' is' : 's are'} already covered by your pantry or list, so {covered === 1 ? "it's" : "they're"} unticked.
                        </Text>
                    ) : null}
                    <View style={[styles.lines, { borderColor: colors.border }]}>
                        {lines.map(l => {
                            const on = selected.has(l.key);
                            const qty = formatQuantity(toBuy(l), l.unit);
                            const note = STATUS_NOTE[l.status];
                            return (
                                <Pressable
                                    key={l.key}
                                    onPress={() => toggle(l.key)}
                                    accessibilityRole="checkbox"
                                    accessibilityState={{ checked: on }}
                                    accessibilityLabel={[l.name, qty, note].filter(Boolean).join(', ')}
                                    style={({ pressed }) => [styles.line, { borderBottomColor: colors.border }, pressed && { opacity: 0.7 }]}
                                >
                                    <Ionicons name={on ? 'checkbox' : 'square-outline'} size={22} color={on ? colors.primary : colors.textMuted} />
                                    <View style={[styles.dot, { backgroundColor: CATEGORIES[l.category].color }]} />
                                    <View style={{ flex: 1 }}>
                                        <Text numberOfLines={1}>{l.name}</Text>
                                        {note || planned.length > 1 ? (
                                            <Text variant="caption" muted numberOfLines={1}>
                                                {[note, planned.length > 1 ? l.sources.join(', ') : null].filter(Boolean).join(' · ')}
                                            </Text>
                                        ) : null}
                                    </View>
                                    {qty ? (
                                        <Text variant="caption" muted>
                                            {qty}
                                        </Text>
                                    ) : null}
                                </Pressable>
                            );
                        })}
                    </View>
                </>
            )}
        </Sheet>
    );
}

const styles = StyleSheet.create({
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    lines: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md, overflow: 'hidden' },
    line: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, minHeight: 50, borderBottomWidth: StyleSheet.hairlineWidth },
    dot: { width: 8, height: 8, borderRadius: 4 },
});
