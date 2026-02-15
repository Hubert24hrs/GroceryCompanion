import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../utils/constants';
import { usePantryItemsByCategory, useListStore } from '../../store/useListStore';

interface PantryListProps {
    onEditItem?: (item: any) => void;
}

export function PantryList({ onEditItem }: PantryListProps) {
    const itemsByCategory = usePantryItemsByCategory();
    const { moveToList, deleteItem } = useListStore();

    const handleItemPress = (item: any) => {
        Alert.alert(
            item.name,
            'Move back to shopping list?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Add to List',
                    onPress: () => moveToList(item.id)
                }
            ]
        );
    };

    const hasItems = Object.keys(itemsByCategory).length > 0;

    return (
        <ScrollView contentContainerStyle={styles.content}>
            {!hasItems ? (
                <View style={styles.emptyState}>
                    <Text style={styles.emptyIcon}>🏠</Text>
                    <Text style={styles.emptyTitle}>Your pantry is empty</Text>
                    <Text style={styles.emptyText}>
                        When you checkout items from your list, they will appear here.
                    </Text>
                </View>
            ) : (
                Object.entries(itemsByCategory).map(([category, items]) => (
                    <View key={category} style={styles.section}>
                        <Text style={styles.categoryTitle}>{category}</Text>
                        {items.map(item => (
                            <TouchableOpacity
                                key={item.id}
                                style={styles.itemRow}
                                onPress={() => handleItemPress(item)}
                                onLongPress={() => onEditItem?.(item)}
                            >
                                <View style={styles.itemInfo}>
                                    <Text style={styles.itemName}>{item.name}</Text>
                                    {item.quantity && (
                                        <Text style={styles.itemQuantity}>
                                            {item.quantity} {item.unit}
                                        </Text>
                                    )}
                                    {item.price && (
                                        <Text style={styles.itemQuantity}>
                                            ${item.price.toFixed(2)}
                                        </Text>
                                    )}
                                </View>
                                <View style={styles.addButton}>
                                    <Text style={styles.addButtonText}>+</Text>
                                </View>
                            </TouchableOpacity>
                        ))}
                    </View>
                ))
            )}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    content: {
        padding: SPACING.lg,
        paddingBottom: 100,
    },
    section: {
        marginBottom: SPACING.xl,
    },
    categoryTitle: {
        fontSize: FONT_SIZES.md,
        fontWeight: '600',
        color: COLORS.primary,
        marginBottom: SPACING.sm,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    itemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: COLORS.surface,
        padding: SPACING.md,
        borderRadius: BORDER_RADIUS.md,
        marginBottom: SPACING.sm,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    itemInfo: {
        flex: 1,
    },
    itemName: {
        fontSize: FONT_SIZES.md,
        color: COLORS.text,
    },
    itemQuantity: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.textSecondary,
        marginTop: 2,
    },
    addButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: COLORS.primary + '20',
        alignItems: 'center',
        justifyContent: 'center',
    },
    addButtonText: {
        fontSize: 20,
        color: COLORS.primary,
        fontWeight: 'bold',
        marginTop: -2,
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: SPACING.xxl,
    },
    emptyIcon: {
        fontSize: 64,
        marginBottom: SPACING.lg,
    },
    emptyTitle: {
        fontSize: FONT_SIZES.lg,
        fontWeight: '600',
        color: COLORS.text,
        marginBottom: SPACING.sm,
    },
    emptyText: {
        fontSize: FONT_SIZES.md,
        color: COLORS.textSecondary,
        textAlign: 'center',
        maxWidth: '80%',
    },
});
