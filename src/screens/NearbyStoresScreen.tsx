import React, { useEffect, useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    SafeAreaView,
    ActivityIndicator,
} from 'react-native';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../utils/constants';
import { Store } from '../types';
import { useListStore } from '../store/useListStore';
import {
    getCurrentLocation,
    findNearbyGroceryStores,
    calculateDistance,
    formatDistance,
    LocationCoords,
} from '../services/maps/nearbyStores';
import { Button } from '../components/common/Button';

interface NearbyStoresScreenProps {
    navigation: any;
    route: any;
}

export function NearbyStoresScreen({ navigation, route }: NearbyStoresScreenProps) {
    const { listId } = route.params;
    const [isLoading, setIsLoading] = useState(true);
    const [stores, setStores] = useState<Store[]>([]);
    const [currentLocation, setCurrentLocation] = useState<LocationCoords | null>(null);
    const [error, setError] = useState<string | null>(null);

    const { updateList } = useListStore();

    useEffect(() => {
        loadNearbyStores();
    }, []);

    const loadNearbyStores = async () => {
        setIsLoading(true);
        setError(null);

        try {
            const location = await getCurrentLocation();

            if (!location) {
                setError('Location permission denied. Please enable location access in settings.');
                setIsLoading(false);
                return;
            }

            setCurrentLocation(location);

            const nearbyStores = await findNearbyGroceryStores(
                location.latitude,
                location.longitude
            );

            // Sort by distance
            const sortedStores = nearbyStores.sort((a, b) => {
                const distA = calculateDistance(
                    location.latitude,
                    location.longitude,
                    a.location.lat,
                    a.location.lng
                );
                const distB = calculateDistance(
                    location.latitude,
                    location.longitude,
                    b.location.lat,
                    b.location.lng
                );
                return distA - distB;
            });

            setStores(sortedStores);
        } catch (err) {
            setError('Failed to load nearby stores. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSelectStore = useCallback(async (store: Store) => {
        await updateList(listId, {
            storeId: store.id,
            storeName: store.name,
        });
        navigation.goBack();
    }, [listId, updateList, navigation]);

    const renderStore = ({ item }: { item: Store }) => {
        const distance = currentLocation
            ? calculateDistance(
                currentLocation.latitude,
                currentLocation.longitude,
                item.location.lat,
                item.location.lng
            )
            : 0;

        return (
            <TouchableOpacity
                style={styles.storeCard}
                onPress={() => handleSelectStore(item)}
                activeOpacity={0.7}
            >
                <View style={styles.storeInfo}>
                    <Text style={styles.storeName}>{item.name}</Text>
                    <Text style={styles.storeAddress}>{item.address}</Text>
                    <View style={styles.storeDetails}>
                        <Text style={[styles.openStatus, { color: item.isOpen ? COLORS.success : COLORS.error }]}>
                            {item.isOpen ? '● Open' : '● Closed'}
                        </Text>
                        {distance > 0 && (
                            <Text style={styles.distance}>{formatDistance(distance)}</Text>
                        )}
                    </View>
                </View>
                <Text style={styles.selectIcon}>→</Text>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Nearby Stores</Text>
                <Text style={styles.subtitle}>Select a store for this list</Text>
            </View>

            {isLoading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                    <Text style={styles.loadingText}>Finding nearby stores...</Text>
                </View>
            ) : error ? (
                <View style={styles.errorContainer}>
                    <Text style={styles.errorIcon}>📍</Text>
                    <Text style={styles.errorText}>{error}</Text>
                    <Button title="Try Again" onPress={loadNearbyStores} />
                </View>
            ) : stores.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <Text style={styles.emptyIcon}>🏪</Text>
                    <Text style={styles.emptyText}>No grocery stores found nearby</Text>
                </View>
            ) : (
                <FlatList
                    data={stores}
                    keyExtractor={(item) => item.id}
                    renderItem={renderStore}
                    contentContainerStyle={styles.listContainer}
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    header: {
        padding: SPACING.lg,
        backgroundColor: COLORS.surface,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.divider,
    },
    title: {
        fontSize: FONT_SIZES.xl,
        fontWeight: '600',
        color: COLORS.text,
    },
    subtitle: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.textSecondary,
        marginTop: SPACING.xs,
    },
    listContainer: {
        padding: SPACING.md,
    },
    storeCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.md,
        marginBottom: SPACING.sm,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    storeInfo: {
        flex: 1,
    },
    storeName: {
        fontSize: FONT_SIZES.md,
        fontWeight: '600',
        color: COLORS.text,
    },
    storeAddress: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.textSecondary,
        marginTop: 2,
    },
    storeDetails: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: SPACING.xs,
        gap: SPACING.md,
    },
    openStatus: {
        fontSize: FONT_SIZES.sm,
        fontWeight: '500',
    },
    distance: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.textSecondary,
    },
    selectIcon: {
        fontSize: 20,
        color: COLORS.primary,
        marginLeft: SPACING.sm,
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingText: {
        marginTop: SPACING.md,
        fontSize: FONT_SIZES.md,
        color: COLORS.textSecondary,
    },
    errorContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: SPACING.xl,
    },
    errorIcon: {
        fontSize: 48,
        marginBottom: SPACING.md,
    },
    errorText: {
        fontSize: FONT_SIZES.md,
        color: COLORS.textSecondary,
        textAlign: 'center',
        marginBottom: SPACING.lg,
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyIcon: {
        fontSize: 48,
        marginBottom: SPACING.md,
    },
    emptyText: {
        fontSize: FONT_SIZES.md,
        color: COLORS.textSecondary,
    },
});
