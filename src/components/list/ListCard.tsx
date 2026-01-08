import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
} from 'react-native';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../utils/constants';
import { ShoppingList } from '../../types';

interface ListCardProps {
    list: ShoppingList;
    itemCount?: number;
    checkedCount?: number;
    onPress: () => void;
    onLongPress?: () => void;
}

export function ListCard({
    list,
    itemCount = 0,
    checkedCount = 0,
    onPress,
    onLongPress
}: ListCardProps) {
    const progress = itemCount > 0 ? checkedCount / itemCount : 0;

    return (
        <TouchableOpacity
            style={[styles.container, { borderLeftColor: list.color }]}
            onPress={onPress}
            onLongPress={onLongPress}
            activeOpacity={0.7}
        >
            <View style={styles.header}>
                <Text style={styles.name} numberOfLines={1}>{list.name}</Text>
                {list.storeName && (
                    <Text style={styles.store} numberOfLines={1}>📍 {list.storeName}</Text>
                )}
            </View>

            <View style={styles.footer}>
                <Text style={styles.count}>
                    {checkedCount}/{itemCount} items
                </Text>

                {itemCount > 0 && (
                    <View style={styles.progressContainer}>
                        <View style={[styles.progressBar, { width: `${progress * 100}%`, backgroundColor: list.color }]} />
                    </View>
                )}
            </View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.md,
        marginBottom: SPACING.md,
        borderLeftWidth: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    header: {
        marginBottom: SPACING.sm,
    },
    name: {
        fontSize: FONT_SIZES.lg,
        fontWeight: '600',
        color: COLORS.text,
        marginBottom: 2,
    },
    store: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.textSecondary,
    },
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    count: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.textSecondary,
    },
    progressContainer: {
        flex: 1,
        height: 4,
        backgroundColor: COLORS.divider,
        borderRadius: BORDER_RADIUS.full,
        marginLeft: SPACING.md,
        overflow: 'hidden',
    },
    progressBar: {
        height: '100%',
        borderRadius: BORDER_RADIUS.full,
    },
});
