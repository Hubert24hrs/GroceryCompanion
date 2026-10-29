import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ShoppingList } from '../../domain/types';
import { Card, IconButton, ProgressBar, Text } from '../../ui/primitives';
import { radius, spacing, useTheme } from '../../ui/theme';

export interface ListCounts {
    total: number;
    done: number;
}

export function countItems(items: { listId: string; isChecked: boolean }[]): Map<string, ListCounts> {
    const counts = new Map<string, ListCounts>();
    for (const i of items) {
        const c = counts.get(i.listId) ?? { total: 0, done: 0 };
        c.total++;
        if (i.isChecked) c.done++;
        counts.set(i.listId, c);
    }
    return counts;
}

export function ListCard({ list, counts, onPress, onMenu }: {
    list: ShoppingList;
    counts: ListCounts | undefined;
    onPress: () => void;
    onMenu?: () => void;
}) {
    const { colors } = useTheme();
    const total = counts?.total ?? 0;
    const done = counts?.done ?? 0;
    const remaining = total - done;
    const detail = total === 0 ? 'Empty' : remaining === 0 ? 'All done' : `${remaining} to get${done ? ` · ${done} in cart` : ''}`;
    return (
        <Card onPress={onPress} onLongPress={onMenu} accessibilityLabel={`${list.name}, ${detail}`} style={styles.card}>
            <View style={[styles.icon, { backgroundColor: list.color }]}>
                <Ionicons name={list.isTemplate ? 'copy' : 'cart'} size={20} color="#fff" />
            </View>
            <View style={styles.body}>
                <Text variant="subheading" numberOfLines={1}>
                    {list.name}
                </Text>
                <Text variant="caption" muted numberOfLines={1}>
                    {[detail, list.storeName].filter(Boolean).join(' · ')}
                </Text>
                {total > 0 && !list.isTemplate ? <ProgressBar value={done / total} color={list.color} /> : null}
            </View>
            {onMenu ? <IconButton icon="ellipsis-horizontal" label={`${list.name} options`} onPress={onMenu} color={colors.textMuted} /> : null}
        </Card>
    );
}

const styles = StyleSheet.create({
    card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
    icon: { width: 42, height: 42, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
    body: { flex: 1, gap: 4 },
});
