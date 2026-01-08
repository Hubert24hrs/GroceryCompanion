import React, { useEffect, useCallback, useState, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    SafeAreaView,
    StatusBar,
    Alert,
} from 'react-native';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../utils/constants';
import { CATEGORY_CONFIG, Category, ListItem } from '../types';
import { useListStore, useCurrentList, useItemsByCategory, useUncheckedCount, useCheckedCount } from '../store/useListStore';
import { QuickAddBar } from '../components/entry/QuickAddBar';
import { CategorySection } from '../components/list/ItemRow';
import { PantryList } from '../components/list/PantryList';
import ConfettiCannon from 'react-native-confetti-cannon';
import * as Haptics from 'expo-haptics';

interface ListDetailScreenProps {
    navigation: any;
    route: any;
}

export function ListDetailScreen({ navigation, route }: ListDetailScreenProps) {
    const { listId } = route.params;
    const [viewMode, setViewMode] = useState<'shopping' | 'pantry'>('shopping');
    const confettiRef = useRef<any>(null);

    const currentList = useCurrentList();
    const itemsByCategory = useItemsByCategory();
    const uncheckedCount = useUncheckedCount();
    const checkedCount = useCheckedCount();

    const { selectList, clearCheckedItems, deleteItem, checkout } = useListStore();

    useEffect(() => {
        selectList(listId);
    }, [listId]);

    // Update navigation title
    useEffect(() => {
        if (currentList) {
            navigation.setOptions({
                title: currentList.name,
                headerStyle: {
                    backgroundColor: currentList.color,
                },
                headerTintColor: COLORS.surface,
                headerRight: () => (
                    <View style={{ flexDirection: 'row', gap: 16 }}>
                        <TouchableOpacity
                            onPress={() => navigation.navigate('NearbyStores', { listId })}
                        >
                            <Text style={{ fontSize: 24 }}>📍</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => navigation.navigate('ShareList', { listId })}
                        >
                            <Text style={{ fontSize: 24 }}>📤</Text>
                        </TouchableOpacity>
                    </View>
                ),
            });
        }
    }, [currentList, navigation]);

    useEffect(() => {
        if (uncheckedCount === 0 && checkedCount > 0 && viewMode === 'shopping') {
            confettiRef.current?.start();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
    }, [uncheckedCount, checkedCount, viewMode]);

    const handleCheckout = useCallback(() => {
        if (checkedCount === 0) return;

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        Alert.alert(
            'Checkout Items?',
            `Move ${checkedCount} checked item${checkedCount > 1 ? 's' : ''} to your Pantry?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Checkout & Move to Pantry',
                    style: 'default',
                    onPress: () => {
                        checkout();
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        Alert.alert('Success', 'Items moved to Pantry');
                    },
                },
            ]
        );
    }, [checkedCount, checkout]);

    const handleItemLongPress = useCallback((item: ListItem) => {
        Alert.alert(
            item.name,
            'What would you like to do?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => deleteItem(item.id),
                },
            ]
        );
    }, [deleteItem]);

    // Get categories that have items
    const categoriesWithItems = Object.entries(itemsByCategory)
        .filter(([_, items]) => items.length > 0)
        .sort((a, b) => {
            const order = Object.keys(CATEGORY_CONFIG);
            return order.indexOf(a[0]) - order.indexOf(b[0]);
        });

    // Split into unchecked and checked
    const uncheckedCategories = categoriesWithItems.filter(([_, items]) =>
        items.some(item => !item.isChecked)
    );

    const hasOnlyCheckedItems = uncheckedCategories.length === 0 && checkedCount > 0;

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={currentList?.color || COLORS.primary} />

            {/* View Toggle */}
            <View style={styles.toggleContainer}>
                <TouchableOpacity
                    style={[styles.toggleButton, viewMode === 'shopping' && styles.toggleButtonActive]}
                    onPress={() => setViewMode('shopping')}
                >
                    <Text style={[styles.toggleText, viewMode === 'shopping' && styles.toggleTextActive]}>Shopping List</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.toggleButton, viewMode === 'pantry' && styles.toggleButtonActive]}
                    onPress={() => setViewMode('pantry')}
                >
                    <Text style={[styles.toggleText, viewMode === 'pantry' && styles.toggleTextActive]}>My Pantry</Text>
                </TouchableOpacity>
            </View>

            {viewMode === 'pantry' ? (
                <PantryList />
            ) : (
                <>
                    {/* Progress header */}

                    {/* Progress header */}
                    <View style={styles.progressHeader}>
                        <View style={styles.progressInfo}>
                            <Text style={styles.progressText}>
                                {uncheckedCount} item{uncheckedCount !== 1 ? 's' : ''} remaining
                            </Text>
                            {checkedCount > 0 && (
                                <TouchableOpacity onPress={handleCheckout}>
                                    <Text style={styles.checkoutText}>Checkout ({checkedCount})</Text>
                                </TouchableOpacity>
                            )}
                        </View>

                        {currentList?.storeName && (
                            <View style={styles.storeInfo}>
                                <Text style={styles.storeIcon}>📍</Text>
                                <Text style={styles.storeName}>{currentList.storeName}</Text>
                            </View>
                        )}
                    </View>

                    {/* Items list */}
                    <ScrollView
                        style={styles.scrollView}
                        contentContainerStyle={styles.scrollContent}
                        keyboardShouldPersistTaps="handled"
                    >
                        {categoriesWithItems.length === 0 ? (
                            <View style={styles.emptyState}>
                                <Text style={styles.emptyIcon}>✨</Text>
                                <Text style={styles.emptyTitle}>List is empty</Text>
                                <Text style={styles.emptyText}>Add your first item below</Text>
                            </View>
                        ) : hasOnlyCheckedItems ? (
                            <View style={styles.completeState}>
                                <Text style={styles.completeIcon}>🎉</Text>
                                <Text style={styles.completeTitle}>Shopping complete!</Text>
                                <Text style={styles.completeText}>All {checkedCount} items checked off</Text>
                            </View>
                        ) : (
                            categoriesWithItems.map(([category, items]) => (
                                <CategorySection
                                    key={category}
                                    category={category}
                                    items={items}
                                    onItemLongPress={handleItemLongPress}
                                />
                            ))
                        )}
                    </ScrollView>

                    {/* Quick add bar */}
                    <QuickAddBar />
                    <ConfettiCannon
                        ref={confettiRef}
                        count={200}
                        origin={{ x: -10, y: 0 }}
                        autoStart={false}
                        fadeOut={true}
                    />
                </>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    progressHeader: {
        backgroundColor: COLORS.surface,
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.md,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.divider,
    },
    progressInfo: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    progressText: {
        fontSize: FONT_SIZES.md,
        color: COLORS.text,
        fontWeight: '500',
    },
    checkoutText: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.primary,
        fontWeight: 'bold',
    },
    toggleContainer: {
        flexDirection: 'row',
        backgroundColor: COLORS.surface,
        padding: SPACING.sm,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.divider,
    },
    toggleButton: {
        flex: 1,
        paddingVertical: SPACING.sm,
        alignItems: 'center',
        borderRadius: BORDER_RADIUS.md,
    },
    toggleButtonActive: {
        backgroundColor: COLORS.background,
    },
    toggleText: {
        fontSize: FONT_SIZES.md,
        color: COLORS.textSecondary,
        fontWeight: '600',
    },
    toggleTextActive: {
        color: COLORS.primary,
    },
    storeInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: SPACING.sm,
    },
    storeIcon: {
        fontSize: 14,
        marginRight: SPACING.xs,
    },
    storeName: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.textSecondary,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingTop: SPACING.md,
        paddingBottom: SPACING.xxl,
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: SPACING.xxl * 2,
    },
    emptyIcon: {
        fontSize: 48,
        marginBottom: SPACING.md,
    },
    emptyTitle: {
        fontSize: FONT_SIZES.lg,
        fontWeight: '600',
        color: COLORS.text,
        marginBottom: SPACING.xs,
    },
    emptyText: {
        fontSize: FONT_SIZES.md,
        color: COLORS.textSecondary,
    },
    completeState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: SPACING.xxl * 2,
    },
    completeIcon: {
        fontSize: 64,
        marginBottom: SPACING.md,
    },
    completeTitle: {
        fontSize: FONT_SIZES.xl,
        fontWeight: '600',
        color: COLORS.primary,
        marginBottom: SPACING.xs,
    },
    completeText: {
        fontSize: FONT_SIZES.md,
        color: COLORS.textSecondary,
    },
});
