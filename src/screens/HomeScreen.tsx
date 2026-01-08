import React, { useEffect, useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    TextInput,
    Modal,
    SafeAreaView,
    StatusBar,
    ActivityIndicator,
} from 'react-native';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, LIST_COLORS } from '../utils/constants';
import { useListStore, useLists, useIsLoading } from '../store/useListStore';
import { useUserStore } from '../store/useUserStore';
import { ListCard } from '../components/list/ListCard';
import { Button } from '../components/common/Button';
import { initDatabase } from '../services/database/sqlite';
import { ShoppingList } from '../types';

interface HomeScreenProps {
    navigation: any;
}

export function HomeScreen({ navigation }: HomeScreenProps) {
    const [isDbReady, setIsDbReady] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newListName, setNewListName] = useState('');
    const [selectedColor, setSelectedColor] = useState(LIST_COLORS[0]);

    const lists = useLists();
    const isLoading = useIsLoading();
    const { loadLists, createList, loadRecentItems } = useListStore();
    const { user } = useUserStore();

    // Initialize database and load data
    useEffect(() => {
        async function init() {
            try {
                await initDatabase();
                setIsDbReady(true);
                await loadLists();
                await loadRecentItems();
            } catch (error) {
                console.error('Failed to initialize database:', error);
            }
        }
        init();


    }, []);

    const handleCreatePress = () => {
        if (!user?.isPro && lists.length >= 3) {
            navigation.navigate('Paywall');
            return;
        }
        setShowCreateModal(true);
    };

    const handleCreateList = useCallback(async () => {
        if (!newListName.trim()) return;

        const newList = await createList(newListName.trim(), selectedColor);
        setShowCreateModal(false);
        setNewListName('');
        setSelectedColor(LIST_COLORS[0]);

        // Navigate to the new list
        navigation.navigate('ListDetail', { listId: newList.id });
    }, [newListName, selectedColor, createList, navigation]);

    const handleListPress = useCallback((list: ShoppingList) => {
        navigation.navigate('ListDetail', { listId: list.id });
    }, [navigation]);

    if (!isDbReady) {
        return (
            <SafeAreaView style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.loadingText}>Loading...</Text>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerRow}>
                    <View>
                        <Text style={styles.title}>Grocery Companion</Text>
                        <Text style={styles.subtitle}>Your shopping lists</Text>
                    </View>
                    <TouchableOpacity
                        onPress={() => navigation.navigate('Settings')}
                        style={styles.settingsButton}
                    >
                        <Text style={styles.settingsIcon}>⚙️</Text>
                    </TouchableOpacity>
                    {!user?.isPro && (
                        <TouchableOpacity
                            onPress={() => navigation.navigate('Paywall')}
                            style={[styles.settingsButton, { marginLeft: 8 }]}
                        >
                            <Text style={styles.settingsIcon}>👑</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* Lists */}
            {lists.length === 0 ? (
                <View style={styles.emptyState}>
                    <Text style={styles.emptyIcon}>🛒</Text>
                    <Text style={styles.emptyTitle}>No lists yet</Text>
                    <Text style={styles.emptyText}>Create your first shopping list to get started</Text>
                    <Button
                        title="Create List"
                        onPress={() => setShowCreateModal(true)}
                        style={{ marginTop: SPACING.lg }}
                    />
                </View>
            ) : (
                <FlatList
                    data={lists}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContainer}
                    renderItem={({ item }) => (
                        <ListCard
                            list={item}
                            onPress={() => handleListPress(item)}
                        />
                    )}
                    refreshing={isLoading}
                    onRefresh={loadLists}
                />
            )}

            {/* FAB */}
            {lists.length > 0 && (
                <TouchableOpacity
                    style={styles.fab}
                    onPress={handleCreatePress}
                    activeOpacity={0.8}
                >
                    <Text style={styles.fabIcon}>+</Text>
                </TouchableOpacity>
            )}

            {/* Create List Modal */}
            <Modal
                visible={showCreateModal}
                animationType="slide"
                transparent
                onRequestClose={() => setShowCreateModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>New List</Text>

                        <TextInput
                            style={styles.modalInput}
                            placeholder="List name"
                            placeholderTextColor={COLORS.textLight}
                            value={newListName}
                            onChangeText={setNewListName}
                            autoFocus
                        />

                        <Text style={styles.colorLabel}>Pick a color</Text>
                        <View style={styles.colorPicker}>
                            {LIST_COLORS.map((color) => (
                                <TouchableOpacity
                                    key={color}
                                    style={[
                                        styles.colorOption,
                                        { backgroundColor: color },
                                        selectedColor === color && styles.colorSelected,
                                    ]}
                                    onPress={() => setSelectedColor(color)}
                                />
                            ))}
                        </View>

                        <View style={styles.modalButtons}>
                            <Button
                                title="Cancel"
                                variant="ghost"
                                onPress={() => setShowCreateModal(false)}
                                style={{ flex: 1 }}
                            />
                            <Button
                                title="Create"
                                onPress={handleCreateList}
                                disabled={!newListName.trim()}
                                style={{ flex: 1 }}
                            />
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.background,
    },
    loadingText: {
        marginTop: SPACING.md,
        fontSize: FONT_SIZES.md,
        color: COLORS.textSecondary,
    },
    header: {
        paddingHorizontal: SPACING.lg,
        paddingTop: SPACING.xl,
        paddingBottom: SPACING.lg,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    settingsButton: {
        padding: SPACING.sm,
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.full,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    settingsIcon: {
        fontSize: 20,
    },
    title: {
        fontSize: FONT_SIZES.xxxl,
        fontWeight: 'bold',
        color: COLORS.text,
    },
    subtitle: {
        fontSize: FONT_SIZES.md,
        color: COLORS.textSecondary,
        marginTop: SPACING.xs,
    },
    listContainer: {
        paddingHorizontal: SPACING.lg,
        paddingBottom: 100,
    },
    emptyState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: SPACING.xl,
    },
    emptyIcon: {
        fontSize: 64,
        marginBottom: SPACING.lg,
    },
    emptyTitle: {
        fontSize: FONT_SIZES.xl,
        fontWeight: '600',
        color: COLORS.text,
        marginBottom: SPACING.sm,
    },
    emptyText: {
        fontSize: FONT_SIZES.md,
        color: COLORS.textSecondary,
        textAlign: 'center',
    },
    fab: {
        position: 'absolute',
        right: SPACING.lg,
        bottom: SPACING.xl,
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
        elevation: 8,
    },
    fabIcon: {
        fontSize: 32,
        color: COLORS.surface,
        marginTop: -2,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: COLORS.surface,
        borderTopLeftRadius: BORDER_RADIUS.xl,
        borderTopRightRadius: BORDER_RADIUS.xl,
        padding: SPACING.lg,
        paddingBottom: SPACING.xxl,
    },
    modalTitle: {
        fontSize: FONT_SIZES.xl,
        fontWeight: '600',
        color: COLORS.text,
        marginBottom: SPACING.lg,
        textAlign: 'center',
    },
    modalInput: {
        backgroundColor: COLORS.background,
        borderRadius: BORDER_RADIUS.lg,
        paddingHorizontal: SPACING.md,
        height: 50,
        fontSize: FONT_SIZES.md,
        color: COLORS.text,
        marginBottom: SPACING.lg,
    },
    colorLabel: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.textSecondary,
        marginBottom: SPACING.sm,
    },
    colorPicker: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: SPACING.sm,
        marginBottom: SPACING.lg,
    },
    colorOption: {
        width: 40,
        height: 40,
        borderRadius: 20,
    },
    colorSelected: {
        borderWidth: 3,
        borderColor: COLORS.text,
    },
    modalButtons: {
        flexDirection: 'row',
        gap: SPACING.md,
    },
});
