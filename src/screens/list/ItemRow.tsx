import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { CATEGORIES } from '../../domain/categories';
import { ListItem } from '../../domain/types';
import { formatQuantity } from '../../domain/units';
import { formatMoney } from '../../state/prefs';
import { IconButton, Text } from '../../ui/primitives';
import { spacing, useTheme } from '../../ui/theme';

export function ItemRow({ item, onToggle, onEdit, readOnly }: {
    item: ListItem;
    onToggle: () => void;
    onEdit: () => void;
    readOnly?: boolean;
}) {
    const { colors } = useTheme();
    const tint = CATEGORIES[item.category].color;
    const qty = formatQuantity(item.quantity, item.unit);
    const meta = [qty, item.notes].filter(Boolean).join(' · ');
    return (
        <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Pressable
                onPress={onToggle}
                disabled={readOnly}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: item.isChecked, disabled: readOnly }}
                accessibilityLabel={`${item.name}${qty ? `, ${qty}` : ''}`}
                style={({ pressed }) => [styles.main, pressed && { opacity: 0.7 }]}
            >
                <View
                    style={[
                        styles.check,
                        { borderColor: item.isChecked ? colors.primary : tint, backgroundColor: item.isChecked ? colors.primary : 'transparent' },
                    ]}
                >
                    {item.isChecked ? <Ionicons name="checkmark" size={16} color={colors.onPrimary} /> : null}
                </View>
                <View style={{ flex: 1 }}>
                    <Text
                        numberOfLines={2}
                        muted={item.isChecked}
                        style={item.isChecked ? { textDecorationLine: 'line-through' } : { fontWeight: '500' }}
                    >
                        {item.name}
                    </Text>
                    {meta ? (
                        <Text variant="caption" muted numberOfLines={1}>
                            {meta}
                        </Text>
                    ) : null}
                </View>
                {item.price != null ? (
                    <Text variant="caption" muted>
                        {formatMoney(item.price)}
                    </Text>
                ) : null}
            </Pressable>
            {!readOnly ? <IconButton icon="pencil" size={18} label={`Edit ${item.name}`} onPress={onEdit} color={colors.textMuted} /> : null}
        </View>
    );
}

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingLeft: spacing.md,
        paddingRight: spacing.xs,
        borderBottomWidth: StyleSheet.hairlineWidth,
        minHeight: 56,
    },
    main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
    check: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
