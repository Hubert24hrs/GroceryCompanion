import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { TabScreenProps } from '../navigation/navigation';
import { addItem, addLowStockToList, adjustPantryQuantity, updatePantryItem } from '../data/repo';
import { expiryStatus, isLowStock, itemKey } from '../domain/pantry';
import { today } from '../domain/dates';
import { hasFeature } from '../domain/entitlements';
import { PantryItem, ShoppingList } from '../domain/types';
import { formatQuantity } from '../domain/units';
import { canEdit } from '../domain/validation';
import { getDb } from '../data/db';
import { LookupError, lookupBarcode } from '../services/barcode';
import { useTable } from '../state/hooks';
import { useIsPro, useSession } from '../state/session';
import { toast, toastError } from '../state/toast';
import { notificationsAvailable } from '../services/notifications';
import { enableExpiryAlerts } from '../state/expiryAlerts';
import { usePrefs } from '../state/prefs';
import { Banner, Button, Card, Chip, EmptyState, Field, IconButton, SectionTitle, Text } from '../ui/primitives';
import { ProLock } from '../ui/ProLock';
import { TabScreen } from '../ui/Screen';
import { ActionSheet } from '../ui/Sheet';
import { radius, spacing, useTheme } from '../ui/theme';
import { byExpiry, LOCATIONS, PantryFilter, quantityStep } from './pantry/pantryUi';
import { PantryDraft, PantryItemSheet } from './pantry/PantryItemSheet';
import { PantryRow } from './pantry/PantryRow';
import { ScanSheet } from './pantry/ScanSheet';

export function PantryScreen({ route, navigation }: TabScreenProps<'Pantry'>) {
    const { colors } = useTheme();
    const pantry = useTable('pantry_items');
    const lists = useTable('lists');
    const editable = canEdit(useSession(s => s.role));
    const isPro = useIsPro();
    const alertsAllowed = hasFeature(isPro, 'pantryAlerts');
    const expiryAlertsOn = usePrefs(s => s.prefs.expiryAlerts);
    const day = today();

    const [filter, setFilter] = useState<PantryFilter>('all');
    const [query, setQuery] = useState('');
    const [editing, setEditing] = useState<PantryItem | null>(null);
    const [draft, setDraft] = useState<PantryDraft | null>(null);
    const [scanOpen, setScanOpen] = useState(false);
    const [scanBusy, setScanBusy] = useState(false);
    const [pickList, setPickList] = useState<null | ((list: ShoppingList) => void)>(null);

    // Home's "expiring" / "running low" tiles deep-link here.
    useEffect(() => {
        if (route.params?.filter) {
            setFilter(route.params.filter === 'attention' && !alertsAllowed ? 'all' : route.params.filter);
            navigation.setParams({ filter: undefined });
        }
    }, [route.params?.filter, navigation, alertsAllowed]);

    const activeLists = useMemo(
        () => lists.filter(l => !l.isArchived && !l.isTemplate).sort((a, b) => a.sortOrder - b.sortOrder),
        [lists],
    );

    const { expiring, low, groups, shown } = useMemo(() => {
        const needsAttention = (p: PantryItem) => isLowStock(p) || ['expired', 'soon'].includes(expiryStatus(p, day));
        const q = itemKey(query);
        const matches = q ? pantry.filter(p => itemKey(p.name).includes(q) || p.notes?.toLowerCase().includes(q)) : pantry;
        const visible =
            filter === 'all' ? matches : filter === 'attention' ? matches.filter(needsAttention) : matches.filter(p => p.location === filter);
        const sorted = [...visible].sort(byExpiry(day));
        return {
            expiring: pantry.filter(p => ['expired', 'soon'].includes(expiryStatus(p, day))).sort(byExpiry(day)),
            low: pantry.filter(isLowStock),
            groups: LOCATIONS.map(l => ({ ...l, items: sorted.filter(p => p.location === l.key) })).filter(g => g.items.length),
            shown: sorted.length,
        };
    }, [pantry, filter, query, day]);

    /** Run `action` with a list: directly when there's one, otherwise ask. */
    const withList = (action: (list: ShoppingList) => void) => {
        if (activeLists.length === 0) {
            toast('Create a shopping list first.', { tone: 'warning', actionLabel: 'Lists', onAction: () => navigation.navigate('Lists') });
        } else if (activeLists.length === 1) {
            action(activeLists[0]);
        } else {
            setPickList(() => action);
        }
    };

    const addLowToList = () =>
        withList(list =>
            addLowStockToList(list.id).then(
                n =>
                    toast(n ? `Added ${n} item${n === 1 ? '' : 's'} to ${list.name}.` : `Everything low is already on ${list.name}.`, {
                        tone: n ? 'success' : 'info',
                        actionLabel: n ? 'Open' : undefined,
                        onAction: () => navigation.navigate('ListDetail', { listId: list.id }),
                    }),
                toastError,
            ),
        );

    const step = (item: PantryItem, direction: 1 | -1) => {
        const updated = adjustPantryQuantity(item.id, direction * quantityStep(item.unit));
        if (direction < 0 && updated && updated.quantity <= 0) {
            toast(`You're out of ${item.name}.`, {
                tone: 'warning',
                actionLabel: activeLists.length ? 'Add to list' : undefined,
                onAction: () =>
                    withList(list => {
                        const { merged } = addItem(list.id, { name: item.name, category: item.category, unit: item.unit });
                        toast(merged ? `${item.name} was already on ${list.name}.` : `Added ${item.name} to ${list.name}.`, { tone: 'success' });
                    }),
            });
        }
    };

    const onCode = async (code: string) => {
        setScanBusy(true);
        try {
            // Already stocked? Count one more instead of opening a form.
            const stocked = getDb().list('pantry_items').find(p => p.barcode === code);
            if (stocked) {
                const updated = adjustPantryQuantity(stocked.id, 1);
                setScanOpen(false);
                toast(`${stocked.name}: you now have ${formatQuantity(updated?.quantity, stocked.unit) || updated?.quantity}.`, {
                    tone: 'success',
                    actionLabel: 'Undo',
                    onAction: () => updatePantryItem(stocked.id, { quantity: stocked.quantity }),
                });
                return;
            }
            const product = await lookupBarcode(code);
            setScanOpen(false);
            setDraft(
                product
                    ? { name: product.brand && !product.name.includes(product.brand) ? `${product.brand} ${product.name}` : product.name, category: product.category, barcode: code }
                    : { barcode: code, unknownBarcode: true },
            );
        } catch (e) {
            if (e instanceof LookupError) {
                setScanOpen(false);
                toast(e.message, { tone: 'warning' });
                setDraft({ barcode: code, unknownBarcode: true });
            } else {
                toastError(e);
            }
        } finally {
            setScanBusy(false);
        }
    };

    const filters: { key: PantryFilter; label: string }[] = [
        { key: 'all', label: `All ${pantry.length}` },
        ...(alertsAllowed ? [{ key: 'attention' as const, label: 'Needs attention' }] : []),
        ...LOCATIONS.map(l => ({ key: l.key, label: l.label })),
    ];

    return (
        <TabScreen
            title="Pantry"
            right={
                editable ? (
                    <>
                        <IconButton
                            icon="barcode-outline"
                            label="Scan a barcode"
                            onPress={() => (hasFeature(isPro, 'barcodeScanner') ? setScanOpen(true) : navigation.navigate('Pro'))}
                            filled
                        />
                        <Button title="Add" icon="add" small onPress={() => setDraft({})} />
                    </>
                ) : null
            }
        >
            {pantry.length === 0 ? (
                <Card>
                    <EmptyState
                        icon="file-tray-stacked-outline"
                        title="Your pantry is empty"
                        message="Add what you have at home, scan a barcode, or finish a shopping trip with “Restock pantry” on."
                        action={editable ? 'Add an item' : undefined}
                        onAction={() => setDraft({})}
                    />
                </Card>
            ) : (
                <>
                    {!alertsAllowed && (expiring.length > 0 || low.length > 0) && !query ? (
                        <ProLock
                            title="Expiry & low-stock alerts"
                            detail="See what to use soon and restock what's running low in one tap."
                            onPress={() => navigation.navigate('Pro')}
                        />
                    ) : null}
                    {alertsAllowed && (expiring.length > 0 || low.length > 0) && filter === 'all' && !query ? (
                        <View style={styles.alerts}>
                            {expiring.length > 0 ? (
                                <Card style={[styles.alert, { borderLeftColor: colors.accent }]}>
                                    <Text variant="subheading">Use soon</Text>
                                    <Text variant="caption" muted numberOfLines={2}>
                                        {expiring.slice(0, 4).map(p => p.name).join(', ')}
                                        {expiring.length > 4 ? ` and ${expiring.length - 4} more` : ''}
                                    </Text>
                                    <Button title={`See ${expiring.length}`} small variant="secondary" onPress={() => setFilter('attention')} />
                                </Card>
                            ) : null}
                            {low.length > 0 ? (
                                <Card style={[styles.alert, { borderLeftColor: colors.warning }]}>
                                    <Text variant="subheading">Running low</Text>
                                    <Text variant="caption" muted numberOfLines={2}>
                                        {low.slice(0, 4).map(p => p.name).join(', ')}
                                        {low.length > 4 ? ` and ${low.length - 4} more` : ''}
                                    </Text>
                                    {editable ? <Button title="Add to list" icon="cart-outline" small onPress={addLowToList} /> : null}
                                </Card>
                            ) : null}
                        </View>
                    ) : null}

                    {alertsAllowed && notificationsAvailable && !expiryAlertsOn && pantry.some(p => p.expiresOn) && !query ? (
                        <Card style={styles.reminder}>
                            <Text variant="caption" muted style={{ flex: 1 }}>
                                Get a reminder on this phone before food expires.
                            </Text>
                            <Button title="Turn on" small variant="secondary" onPress={() => void enableExpiryAlerts().catch(toastError)} />
                        </Card>
                    ) : null}

                    <View style={{ gap: spacing.md }}>
                        <Field value={query} onChangeText={setQuery} placeholder="Search your pantry" accessibilityLabel="Search your pantry" />
                        <View style={styles.chips}>
                            {filters.map(f => (
                                <Chip key={f.key} label={f.label} selected={filter === f.key} onPress={() => setFilter(f.key)} />
                            ))}
                        </View>
                    </View>

                    {shown === 0 ? (
                        <EmptyState
                            icon={query ? 'search' : 'checkmark-circle-outline'}
                            title={query ? 'No matches' : filter === 'attention' ? 'All good' : 'Nothing here'}
                            message={query ? `Nothing in the pantry matches “${query}”.` : filter === 'attention' ? 'Nothing is expiring or running low.' : undefined}
                        />
                    ) : (
                        groups.map(g => (
                            <View key={g.key}>
                                <SectionTitle title={`${g.label} · ${g.items.length}`} />
                                <View style={[styles.group, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                                    {g.items.map(p => (
                                        <PantryRow key={p.id} item={p} todayIso={day} readOnly={!editable} onPress={() => setEditing(p)} onStep={d => step(p, d)} />
                                    ))}
                                </View>
                            </View>
                        ))
                    )}
                    {!editable ? <Banner tone="info" icon="eye-outline" message="You can view the pantry. Ask the household owner for editor access to make changes." /> : null}
                </>
            )}

            <PantryItemSheet item={editing} draft={draft} onClose={() => (setEditing(null), setDraft(null))} />
            <ScanSheet visible={scanOpen} onClose={() => setScanOpen(false)} onCode={onCode} busy={scanBusy} />
            <ActionSheet
                visible={!!pickList}
                onClose={() => setPickList(null)}
                title="Add to which list?"
                actions={activeLists.map(l => ({ label: l.name, icon: 'cart-outline', onPress: () => pickList?.(l) }))}
            />
        </TabScreen>
    );
}

const styles = StyleSheet.create({
    alerts: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
    reminder: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    alert: { flex: 1, minWidth: 220, gap: spacing.sm, borderLeftWidth: 4 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    group: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
});
