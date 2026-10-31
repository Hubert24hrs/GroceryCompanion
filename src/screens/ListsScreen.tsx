import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { TabScreenProps } from '../navigation/navigation';
import { copyList, deleteList, setListArchived } from '../data/repo';
import { canCreateList, FREE_LIMITS, hasFeature } from '../domain/entitlements';
import { ShoppingList } from '../domain/types';
import { canEdit } from '../domain/validation';
import { useTable } from '../state/hooks';
import { useIsPro, useSession } from '../state/session';
import { toast, toastError } from '../state/toast';
import { Button, Card, EmptyState, SectionTitle, Text } from '../ui/primitives';
import { TabScreen } from '../ui/Screen';
import { ActionItem, ActionSheet, ConfirmSheet } from '../ui/Sheet';
import { spacing } from '../ui/theme';
import { countItems, ListCard } from './lists/ListCard';
import { ListFormSheet } from './lists/ListFormSheet';

export function ListsScreen({ navigation }: TabScreenProps<'Lists'>) {
    const lists = useTable('lists');
    const items = useTable('items');
    const isPro = useIsPro();
    const editable = canEdit(useSession(s => s.role));

    const [formOpen, setFormOpen] = useState(false);
    const [editing, setEditing] = useState<ShoppingList | null>(null);
    const [menuFor, setMenuFor] = useState<ShoppingList | null>(null);
    const [deleting, setDeleting] = useState<ShoppingList | null>(null);
    const [showArchived, setShowArchived] = useState(false);

    const counts = useMemo(() => countItems(items), [items]);
    const { active, templates, archived } = useMemo(() => {
        const sorted = [...lists].sort((a, b) => a.sortOrder - b.sortOrder);
        return {
            active: sorted.filter(l => !l.isArchived && !l.isTemplate),
            templates: sorted.filter(l => l.isTemplate && !l.isArchived),
            archived: sorted.filter(l => l.isArchived),
        };
    }, [lists]);

    const open = (list: ShoppingList) => navigation.navigate('ListDetail', { listId: list.id });

    const guardNewList = (): boolean => {
        if (canCreateList(isPro, active.length)) return true;
        toast(`The free plan includes ${FREE_LIMITS.activeLists} active lists. Archive one or upgrade to Pro for unlimited lists.`, { tone: 'warning', actionLabel: 'See Pro', onAction: () => navigation.navigate('Pro') });
        return false;
    };

    const newList = () => {
        if (!guardNewList()) return;
        setEditing(null);
        setFormOpen(true);
    };

    const startFromTemplate = async (template: ShoppingList) => {
        if (!guardNewList()) return;
        try {
            open(await copyList(template.id, { name: template.name, isTemplate: false }));
        } catch (e) {
            toastError(e);
        }
    };

    const menuActions = (list: ShoppingList): ActionItem[] => {
        if (!editable) return [{ label: 'Open', icon: 'open-outline', onPress: () => open(list) }];
        const actions: ActionItem[] = [{ label: 'Edit details', icon: 'create-outline', onPress: () => (setEditing(list), setFormOpen(true)) }];
        if (!list.isArchived) {
            actions.push({
                label: 'Duplicate',
                icon: 'copy-outline',
                onPress: () => {
                    if (!guardNewList()) return;
                    copyList(list.id, { name: `${list.name} (copy)`, isTemplate: list.isTemplate }).then(
                        () => toast('List duplicated', { tone: 'success' }),
                        toastError,
                    );
                },
            });
        }
        if (!list.isTemplate && !list.isArchived) {
            actions.push({
                label: 'Save as template',
                icon: 'bookmark-outline',
                onPress: () => {
                    if (!hasFeature(isPro, 'listTemplates')) {
                        toast('Reusable templates are a Pro feature.', { tone: 'warning', actionLabel: 'See Pro', onAction: () => navigation.navigate('Pro') });
                        return;
                    }
                    copyList(list.id, { name: list.name, isTemplate: true }).then(
                        () => toast('Saved as a template. Find it under Templates.', { tone: 'success' }),
                        toastError,
                    );
                },
            });
        }
        actions.push(
            list.isArchived
                ? {
                      label: 'Restore',
                      icon: 'arrow-undo-outline',
                      onPress: () => {
                          if (!list.isTemplate && !guardNewList()) return;
                          setListArchived(list.id, false);
                      },
                  }
                : {
                      label: 'Archive',
                      icon: 'archive-outline',
                      onPress: () => {
                          setListArchived(list.id, true);
                          toast(`Archived “${list.name}”`, { actionLabel: 'Undo', onAction: () => setListArchived(list.id, false) });
                      },
                  },
            { label: 'Delete', icon: 'trash-outline', destructive: true, onPress: () => setDeleting(list) },
        );
        return actions;
    };

    return (
        <TabScreen
            title="Lists"
            right={editable ? <Button title="New" icon="add" small onPress={newList} /> : null}
        >
            {active.length === 0 ? (
                <Card>
                    <EmptyState
                        icon="cart-outline"
                        title="No lists yet"
                        message="Start a list for your next trip. Items are grouped by aisle automatically."
                        action={editable ? 'Create a list' : undefined}
                        onAction={newList}
                    />
                </Card>
            ) : (
                <View style={{ gap: spacing.sm }}>
                    {active.map(l => (
                        <ListCard key={l.id} list={l} counts={counts.get(l.id)} onPress={() => open(l)} onMenu={() => setMenuFor(l)} />
                    ))}
                    {!isPro ? (
                        <Text variant="caption" muted style={{ textAlign: 'center' }}>
                            {active.length} of {FREE_LIMITS.activeLists} free lists in use
                        </Text>
                    ) : null}
                </View>
            )}

            {templates.length > 0 ? (
                <View>
                    <SectionTitle title="Templates" />
                    <Text variant="caption" muted style={{ marginBottom: spacing.sm }}>
                        Tap a template to start a fresh list from it.
                    </Text>
                    <View style={{ gap: spacing.sm }}>
                        {templates.map(t => (
                            <ListCard key={t.id} list={t} counts={counts.get(t.id)} onPress={() => startFromTemplate(t)} onMenu={() => setMenuFor(t)} />
                        ))}
                    </View>
                </View>
            ) : null}

            {archived.length > 0 ? (
                <View>
                    <SectionTitle
                        title={`Archived (${archived.length})`}
                        action={showArchived ? 'Hide' : 'Show'}
                        onAction={() => setShowArchived(v => !v)}
                    />
                    {showArchived ? (
                        <View style={{ gap: spacing.sm }}>
                            {archived.map(l => (
                                <ListCard key={l.id} list={l} counts={counts.get(l.id)} onPress={() => open(l)} onMenu={() => setMenuFor(l)} />
                            ))}
                        </View>
                    ) : null}
                </View>
            ) : null}

            <ListFormSheet
                visible={formOpen}
                list={editing}
                onClose={() => setFormOpen(false)}
                onSaved={saved => {
                    if (!editing) open(saved);
                }}
            />
            <ActionSheet
                visible={!!menuFor}
                title={menuFor?.name ?? ''}
                onClose={() => setMenuFor(null)}
                actions={menuFor ? menuActions(menuFor) : []}
            />
            <ConfirmSheet
                visible={!!deleting}
                onClose={() => setDeleting(null)}
                title="Delete list?"
                message={`“${deleting?.name}” and its items will be removed for everyone in your household.`}
                confirmLabel="Delete"
                onConfirm={() => {
                    if (deleting) deleteList(deleting.id).catch(toastError);
                }}
            />
        </TabScreen>
    );
}
