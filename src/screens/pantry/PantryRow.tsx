import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { CATEGORIES } from '../../domain/categories';
import { expiryStatus, isLowStock } from '../../domain/pantry';
import { PantryItem } from '../../domain/types';
import { formatQuantity } from '../../domain/units';
import { IconButton, Text } from '../../ui/primitives';
import { radius, spacing, useTheme } from '../../ui/theme';
import { expiryLabel } from './pantryUi';

export function PantryRow({ item, todayIso, onPress, onStep, readOnly }: {
    item: PantryItem;
    todayIso: string;
    onPress: () => void;
    onStep: (direction: 1 | -1) => void;
    readOnly?: boolean;
}) {
    const { colors } = useTheme();
    const cat = CATEGORIES[item.category];
    const status = expiryStatus(item, todayIso);
    const low = isLowStock(item);
    const expiry = expiryLabel(item, todayIso);
    const expiryColor = status === 'expired' ? colors.danger : status === 'soon' ? colors.warning : colors.textMuted;
    const qty = formatQuantity(item.quantity, item.unit) || String(item.quantity);

    return (
        <View style={[styles.row, { borderBottomColor: colors.border }]}>
            <Pressable
                onPress={onPress}
                disabled={readOnly}
                accessibilityRole="button"
                accessibilityLabel={[item.name, qty, expiry, low ? 'running low' : null].filter(Boolean).join(', ')}
                style={({ pressed }) => [styles.main, pressed && { opacity: 0.7 }]}
            >
                <View style={[styles.icon, { backgroundColor: cat.color + '22' }]}>
                    <MaterialCommunityIcons name={cat.icon as never} size={18} color={cat.color} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                    <Text numberOfLines={1} style={{ fontWeight: '500' }}>
                        {item.name}
                    </Text>
                    <View style={styles.meta}>
                        {low ? (
                            <View style={[styles.badge, { backgroundColor: colors.warningSoft }]}>
                                <Text variant="caption" color={colors.warning} style={{ fontWeight: '700', fontSize: 11 }}>
                                    {item.quantity <= 0 ? 'OUT' : 'LOW'}
                                </Text>
                            </View>
                        ) : null}
                        {expiry ? (
                            <Text variant="caption" color={expiryColor} numberOfLines={1} style={status !== 'ok' ? { fontWeight: '600' } : undefined}>
                                {expiry}
                            </Text>
                        ) : null}
                    </View>
                </View>
            </Pressable>
            <View style={styles.stepper}>
                {!readOnly ? <IconButton icon="remove" size={18} label={`Use one ${item.name}`} onPress={() => onStep(-1)} disabled={item.quantity <= 0} filled /> : null}
                <Text variant="label" style={styles.qty} numberOfLines={1}>
                    {qty}
                </Text>
                {!readOnly ? <IconButton icon="add" size={18} label={`Add one ${item.name}`} onPress={() => onStep(1)} filled /> : null}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, minHeight: 60 },
    main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
    icon: { width: 34, height: 34, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
    meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    badge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
    stepper: { flexDirection: 'row', alignItems: 'center', gap: 2 },
    qty: { minWidth: 44, textAlign: 'center' },
});
