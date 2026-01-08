import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
} from 'react-native';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../utils/constants';
import { CATEGORY_CONFIG, ListItem } from '../../types';
import { useListStore } from '../../store/useListStore';
import * as Haptics from 'expo-haptics';

interface ItemRowProps {
    item: ListItem;
    onPress?: () => void;
    onLongPress?: () => void;
}

export function ItemRow({ item, onPress, onLongPress }: ItemRowProps) {
    const { toggleItem, deleteItem } = useListStore();

    const handleToggle = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        await toggleItem(item.id);
    };

    const categoryConfig = CATEGORY_CONFIG[item.category];

    return (
        <TouchableOpacity
            style={[styles.container, item.isChecked && styles.checkedContainer]}
            onPress={handleToggle}
            onLongPress={onLongPress}
            activeOpacity={0.7}
        >
            {/* Checkbox */}
            <View style={[styles.checkbox, item.isChecked && styles.checkedCheckbox]}>
                {item.isChecked && <Text style={styles.checkmark}>✓</Text>}
            </View>

            {/* Content */}
            <View style={styles.content}>
                <Text
                    style={[styles.name, item.isChecked && styles.checkedName]}
                    numberOfLines={1}
                >
                    {item.name}
                </Text>

                {(item.quantity || item.notes) && (
                    <Text style={styles.details} numberOfLines={1}>
                        {item.quantity && `${item.quantity}${item.unit ? ` ${item.unit}` : ''}`}
                        {item.quantity && item.notes && ' · '}
                        {item.notes}
                    </Text>
                )}
            </View>

            {/* Category Badge */}
            <View style={[styles.categoryBadge, { backgroundColor: categoryConfig.color + '20' }]}>
                <Text style={styles.categoryEmoji}>{categoryConfig.icon}</Text>
            </View>
        </TouchableOpacity>
    );
}

interface CategorySectionProps {
    category: string;
    items: ListItem[];
    onItemPress?: (item: ListItem) => void;
    onItemLongPress?: (item: ListItem) => void;
}

export function CategorySection({ category, items, onItemPress, onItemLongPress }: CategorySectionProps) {
    const categoryConfig = CATEGORY_CONFIG[category as keyof typeof CATEGORY_CONFIG] || CATEGORY_CONFIG.other;
    const uncheckedItems = items.filter(item => !item.isChecked);
    const checkedItems = items.filter(item => item.isChecked);

    if (items.length === 0) return null;

    return (
        <View style={styles.section}>
            <View style={[styles.sectionHeader, { borderLeftColor: categoryConfig.color }]}>
                <Text style={styles.sectionEmoji}>{categoryConfig.icon}</Text>
                <Text style={styles.sectionTitle}>{categoryConfig.label}</Text>
                <Text style={styles.sectionCount}>
                    {uncheckedItems.length}/{items.length}
                </Text>
            </View>

            {uncheckedItems.map(item => (
                <ItemRow
                    key={item.id}
                    item={item}
                    onPress={() => onItemPress?.(item)}
                    onLongPress={() => onItemLongPress?.(item)}
                />
            ))}

            {checkedItems.map(item => (
                <ItemRow
                    key={item.id}
                    item={item}
                    onPress={() => onItemPress?.(item)}
                    onLongPress={() => onItemLongPress?.(item)}
                />
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    // Item Row styles
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: SPACING.md,
        paddingHorizontal: SPACING.md,
        backgroundColor: COLORS.surface,
        marginHorizontal: SPACING.md,
        marginBottom: SPACING.xs,
        borderRadius: BORDER_RADIUS.lg,
        minHeight: 56,
    },
    checkedContainer: {
        opacity: 0.6,
    },
    checkbox: {
        width: 24,
        height: 24,
        borderRadius: BORDER_RADIUS.full,
        borderWidth: 2,
        borderColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: SPACING.md,
    },
    checkedCheckbox: {
        backgroundColor: COLORS.primary,
    },
    checkmark: {
        color: COLORS.surface,
        fontSize: 14,
        fontWeight: 'bold',
    },
    content: {
        flex: 1,
        marginRight: SPACING.sm,
    },
    name: {
        fontSize: FONT_SIZES.md,
        fontWeight: '500',
        color: COLORS.text,
        textTransform: 'capitalize',
    },
    checkedName: {
        textDecorationLine: 'line-through',
        color: COLORS.textSecondary,
    },
    details: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.textSecondary,
        marginTop: 2,
    },
    categoryBadge: {
        width: 32,
        height: 32,
        borderRadius: BORDER_RADIUS.full,
        alignItems: 'center',
        justifyContent: 'center',
    },
    categoryEmoji: {
        fontSize: 16,
    },

    // Category Section styles
    section: {
        marginBottom: SPACING.lg,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: SPACING.sm,
        paddingHorizontal: SPACING.md,
        marginHorizontal: SPACING.md,
        marginBottom: SPACING.xs,
        borderLeftWidth: 4,
        backgroundColor: COLORS.background,
        borderRadius: BORDER_RADIUS.sm,
    },
    sectionEmoji: {
        fontSize: 18,
        marginRight: SPACING.sm,
    },
    sectionTitle: {
        flex: 1,
        fontSize: FONT_SIZES.md,
        fontWeight: '600',
        color: COLORS.text,
    },
    sectionCount: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.textSecondary,
    },
});
