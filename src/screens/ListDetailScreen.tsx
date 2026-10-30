import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useLayoutEffect, useMemo, useState } from 'react';
import { SectionList, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RootScreenProps } from '../navigation/navigation';
import { addLowStockToList, clearChecked, deleteList, finishTrip, restoreItem, toggleItem, uncheckAll } from '../data/repo';
import { CATEGORIES, compareCategories } from '../domain/categories';
import { Category, ListItem } from '../domain/types';
import { canEdit } from '../domain/validation';
import { useRecord, useTable } from '../state/hooks';
import { formatMoney } from '../state/prefs';
import { useIsPro, useSession } from '../state/session';
import { toast, toastError } from '../state/toast';
import { Button, Card, EmptyState, IconButton, ProgressBar, tap, Text } from '../ui/primitives';
import { layout } from '../ui/Screen';
import { ActionItem, ActionSheet, ConfirmSheet, Sheet } from '../ui/Sheet';
import { radius, spacing, useTheme } from '../ui/theme';
import { EditItemSheet } from './list/EditItemSheet';
import { ItemRow } from './list/ItemRow';
import { QuickAddBar } from './list/QuickAddBar';
import { ListFormSheet } from './lists/ListFormSheet';

interface Section {
    key: Category | 'cart';
    title: string;
    color: string;
    icon: string;
    data: ListItem[];
}

const sumPrices = (items: ListItem[]) => Math.round(items.reduce((s, i) => s + (i.price ?? 0), 0) * 100) / 100;

export function ListDetailScreen({ route, navigation }: RootScreenProps<'ListDetail'>) {
    const { listId } = route.params;
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const list = useRecord('lists', listId);
    const allItems = useTable('items');
    const editable = canEdit(useSession(s => s.role));
    const isPro = useIsPro();

    const [editing, setEditing] = useState<ListItem | null>(null);
    const [menuOpen, setMenuOpen] = useState(false);
    const [formOpen, setFormOpen] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [finishing, setFinishing] = useState(false);
    // Frozen when the sheet opens, so it doesn't flash "0 items" while closing after the trip is saved.
    const [trip, setTrip] = useState({ count: 0, total: 0, remaining: 0 });
    const [restock, setRestock] = useState(true);

    const items = useMemo(() => allItems.filter(i => i.listId === listId), [allItems, listId]);
    const checked = useMemo(
        () => items.filter(i => i.isChecked).sort((a, b) => (b.checkedAt ?? '').localeCompare(a.checkedAt ?? '')),
        [items],
    );

    const sections = useMemo<Section[]>(() => {
        const byCategory = new Map<Category, ListItem[]>();
        for (const i of items) {
            if (i.isChecked) continue;
            byCategory.set(i.category, [...(byCategory.get(i.category) ?? []), i]);
        }
        const result: Section[] = [...byCategory.entries()]
            .sort(([a], [b]) => compareCategories(a, b))
            .map(([cat, data]) => ({
                key: cat,
                title: CATEGORIES[cat].label,
                color: CATEGORIES[cat].color,
                icon: CATEGORIES[cat].icon,
                data: data.sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
            }));
        if (checked.length) result.push({ key: 'cart', title: 'In cart', color: colors.primary, icon: 'cart-check', data: checked });
        return result;
    }, [items, checked, colors.primary]);

    useLayoutEffect(() => {
        navigation.setOptions({
            title: list?.name ?? 'List',
            headerRight: () =>
                list && editable ? <IconButton icon="ellipsis-horizontal-circle" label="List options" onPress={() => setMenuOpen(true)} color={colors.primary} /> : null,
        });
    }, [navigation, list, editable, colors.primary]);

    if (!list) {
        return (
            <View style={[styles.root, { backgroundColor: colors.background }]}>
                <EmptyState icon="trash-outline" title="This list is gone" message="It may have been deleted on another device." action="Back to lists" onAction={() => navigation.goBack()} />
            </View>
        );
    }

    const estimated = sumPrices(items);
    const cartTotal = sumPrices(checked);
    const remaining = items.length - checked.length;

    const menu: ActionItem[] = [
        { label: 'Edit details', icon: 'create-outline', onPress: () => setFormOpen(true) },
        {
            label: 'Add low-stock pantry items',
            icon: 'file-tray-stacked-outline',
            onPress: () =>
                !isPro
                    ? navigation.navigate('Pro')
                    : addLowStockToList(listId).then(
                    n => toast(n ? `Added ${n} low-stock item${n === 1 ? '' : 's'}.` : 'Nothing in the pantry is running low.', { tone: n ? 'success' : 'info' }),
                    toastError,
                ),
        },
    ];
    if (checked.length) {
        menu.push(
            { label: 'Uncheck all', icon: 'refresh', onPress: () => void uncheckAll(listId).catch(toastError) },
            {
                label: 'Remove checked items',
                icon: 'remove-circle-outline',
                onPress: () =>
                    clearChecked(listId).then(
                        ids =>
                            toast(`Removed ${ids.length} item${ids.length === 1 ? '' : 's'}.`, {
                                actionLabel: 'Undo',
                                onAction: () => ids.forEach(restoreItem),
                            }),
                        toastError,
                    ),
            },
        );
    }
    menu.push({ label: 'Delete list', icon: 'trash-outline', destructive: true, onPress: () => setConfirmDelete(true) });

    const finish = async () => {
        setFinishing(false);
        try {
            const s = await finishTrip(listId, { restockPantry: restock });
            const parts = [`${s.purchased} item${s.purchased === 1 ? '' : 's'} bought`];
            if (s.spent > 0) parts.push(`${formatMoney(s.spent)} spent`);
            if (s.restocked > 0) parts.push(`${s.restocked} added to pantry`);
            toast(`Trip saved: ${parts.join(', ')}.`, { tone: 'success', durationMs: 4000 });
        } catch (e) {
            toastError(e);
        }
    };

    const header = (
        <View style={styles.header}>
            {editable ? <QuickAddBar listId={listId} /> : (
                <Card style={{ padding: spacing.md }}>
                    <Text variant="caption" muted>
                        You can view this list. Ask the household owner for editor access to make changes.
                    </Text>
                </Card>
            )}
            <View style={styles.stats}>
                <Text variant="caption" muted>
                    {remaining} to get{checked.length ? ` · ${checked.length} in cart` : ''}
                    {list.storeName ? ` · ${list.storeName}` : ''}
                </Text>
                {estimated > 0 ? (
                    <Text variant="caption" muted>
                        Est. {formatMoney(estimated)}
                    </Text>
                ) : null}
            </View>
            {list.budget ? (
                <View style={{ gap: 6 }}>
                    <ProgressBar value={estimated / list.budget} color={estimated > list.budget ? colors.danger : list.color} />
                    <Text variant="caption" color={estimated > list.budget ? colors.danger : colors.textMuted}>
                        {estimated > list.budget
                            ? `${formatMoney(estimated - list.budget)} over the ${formatMoney(list.budget)} budget`
                            : `${formatMoney(list.budget - estimated)} left of ${formatMoney(list.budget)}`}
                    </Text>
                </View>
            ) : null}
        </View>
    );

    return (
        <View style={[styles.root, { backgroundColor: colors.background }]}>
            <SectionList
                sections={sections}
                keyExtractor={i => i.id}
                stickySectionHeadersEnabled={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + (checked.length ? 110 : 40) }]}
                ListHeaderComponent={header}
                ListEmptyComponent={
                    <EmptyState
                        icon="basket-outline"
                        title="Nothing on this list"
                        message={editable ? 'Type a few items above — separate them with commas.' : 'Items your household adds will show up here.'}
                    />
                }
                renderSectionHeader={({ section }) => (
                    <View style={[styles.band, { backgroundColor: colors.surfaceAlt, borderLeftColor: section.color }]}>
                        <MaterialCommunityIcons name={section.icon as never} size={18} color={section.color} />
                        <Text variant="label" style={{ flex: 1 }}>
                            {section.title}
                        </Text>
                        <Text variant="caption" muted>
                            {section.data.length}
                        </Text>
                    </View>
                )}
                renderSectionFooter={() => <View style={{ height: spacing.md }} />}
                renderItem={({ item, index, section }) => (
                    <View style={index === section.data.length - 1 ? styles.lastRow : undefined}>
                        <ItemRow
                            item={item}
                            readOnly={!editable}
                            onToggle={() => {
                                tap();
                                toggleItem(item.id);
                            }}
                            onEdit={() => setEditing(item)}
                        />
                    </View>
                )}
            />

            {editable && checked.length > 0 ? (
                <View style={[styles.finishBar, { paddingBottom: insets.bottom + spacing.md, backgroundColor: colors.surface, borderTopColor: colors.border }]}>
                    <View style={layout.page}>
                        <Button
                            title={`Finish trip · ${checked.length} item${checked.length === 1 ? '' : 's'}${cartTotal ? ` · ${formatMoney(cartTotal)}` : ''}`}
                            icon="checkmark-done"
                            variant="accent"
                            onPress={() => {
                                setTrip({ count: checked.length, total: cartTotal, remaining });
                                setFinishing(true);
                            }}
                        />
                    </View>
                </View>
            ) : null}

            <EditItemSheet item={editing} onClose={() => setEditing(null)} />
            <ActionSheet visible={menuOpen} onClose={() => setMenuOpen(false)} title={list.name} actions={menu} />
            <ListFormSheet visible={formOpen} onClose={() => setFormOpen(false)} list={list} />
            <ConfirmSheet
                visible={confirmDelete}
                onClose={() => setConfirmDelete(false)}
                title="Delete list?"
                message={`“${list.name}” and its ${items.length} item${items.length === 1 ? '' : 's'} will be removed for everyone in your household.`}
                confirmLabel="Delete"
                onConfirm={() => {
                    navigation.goBack();
                    deleteList(listId).catch(toastError);
                }}
            />
            <Sheet
                visible={finishing}
                onClose={() => setFinishing(false)}
                title="Finish trip"
                footer={<Button title="Save trip" icon="checkmark-done" variant="accent" onPress={finish} />}
            >
                <Text muted>
                    {trip.count} checked item{trip.count === 1 ? '' : 's'} will leave the list.
                    {trip.total > 0 ? ` ${formatMoney(trip.total)} goes into your spending history.` : ' Add prices to items to track spending.'}
                </Text>
                <View style={[styles.toggle, { backgroundColor: colors.surfaceAlt }]}>
                    <View style={{ flex: 1, gap: 2 }}>
                        <Text variant="label">Restock pantry</Text>
                        <Text variant="caption" muted>
                            Add food items to your pantry so you know what you have.
                        </Text>
                    </View>
                    <Switch value={restock} onValueChange={setRestock} trackColor={{ true: colors.primary, false: colors.border }} />
                </View>
                {trip.remaining > 0 ? (
                    <Text variant="caption" muted>
                        {trip.remaining} unchecked item{trip.remaining === 1 ? '' : 's'} will stay on the list.
                    </Text>
                ) : null}
            </Sheet>
        </View>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1 },
    content: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, ...layout.page },
    header: { gap: spacing.md, marginBottom: spacing.lg },
    stats: { flexDirection: 'row', justifyContent: 'space-between' },
    band: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderLeftWidth: 4,
        borderTopLeftRadius: radius.sm,
        borderTopRightRadius: radius.md,
    },
    lastRow: { borderBottomLeftRadius: radius.md, borderBottomRightRadius: radius.md, overflow: 'hidden' },
    finishBar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: spacing.lg, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth },
    toggle: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.md },
});
