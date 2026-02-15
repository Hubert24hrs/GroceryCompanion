import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../utils/constants';
import { PremiumFeatureRow } from '../components/monetization/PremiumFeatureRow';
import { useUserStore } from '../store/useUserStore';

interface PaywallScreenProps {
    navigation: any;
    route?: any;
}

export function PaywallScreen({ navigation }: PaywallScreenProps) {
    const { setProStatus } = useUserStore();
    const [isLoading, setIsLoading] = useState(false);

    const handleSubscribe = async () => {
        setIsLoading(true);
        // Mock purchase delay
        setTimeout(() => {
            setIsLoading(false);
            setProStatus(true);
            Alert.alert(
                "Success!",
                "You are now a Premium member. Enjoy the ad-free experience!",
                [{ text: "Awesome", onPress: () => navigation.goBack() }]
            );
        }, 1500);
    };

    const handleRestore = () => {
        setIsLoading(true);
        setTimeout(() => {
            setIsLoading(false);
            setProStatus(true);
            Alert.alert("Restored", "Your purchases have been restored.");
        }, 1500);
    };

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeButton}>
                        <Ionicons name="close" size={28} color={COLORS.textSecondary} />
                    </TouchableOpacity>
                </View>

                <View style={styles.hero}>
                    <Image
                        source={{ uri: 'https://images.unsplash.com/photo-1556742049-0cfed4f7a07d?q=80&w=1974&auto=format&fit=crop' }}
                        style={styles.heroImage}
                    />
                    <Text style={styles.title}>Unlock Premium</Text>
                    <Text style={styles.subtitle}>Get the most out of Grocery Companion</Text>
                </View>

                <View style={styles.features}>
                    <PremiumFeatureRow icon="ban" text="Remove All Ads" />
                    <PremiumFeatureRow icon="stats-chart" text="Advanced Analytics (Coming Soon)" />
                    <PremiumFeatureRow icon="people" text="Unlimited Shared Lists (Coming Soon)" />
                    <PremiumFeatureRow icon="star" text="Exclusive Premium Recipes" />
                </View>

                <View style={styles.pricingContainer}>
                    <View style={styles.priceCard}>
                        <Text style={styles.period}>Monthly</Text>
                        <Text style={styles.price}>$2.99</Text>
                        <Text style={styles.perMonth}>/ month</Text>
                    </View>
                </View>

                <TouchableOpacity
                    style={styles.subscribeButton}
                    onPress={handleSubscribe}
                    disabled={isLoading}
                >
                    {isLoading ? (
                        <ActivityIndicator color={COLORS.surface} />
                    ) : (
                        <Text style={styles.subscribeText}>Subscribe Now</Text>
                    )}
                </TouchableOpacity>

                <TouchableOpacity onPress={handleRestore} style={styles.restoreButton}>
                    <Text style={styles.restoreText}>Restore Purchases</Text>
                </TouchableOpacity>

                <Text style={styles.disclaimer}>
                    Subscription automatically renews unless auto-renew is turned off at least 24-hours before the end of the current period.
                </Text>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    scrollContent: {
        paddingBottom: SPACING.xl,
    },
    header: {
        padding: SPACING.md,
        alignItems: 'flex-end',
    },
    closeButton: {
        padding: SPACING.xs,
    },
    hero: {
        alignItems: 'center',
        marginBottom: SPACING.xl,
        paddingHorizontal: SPACING.lg,
    },
    heroImage: {
        width: 120,
        height: 120,
        borderRadius: 60,
        marginBottom: SPACING.lg,
        backgroundColor: COLORS.secondary,
    },
    title: {
        fontSize: FONT_SIZES.xxl,
        fontWeight: 'bold',
        color: COLORS.text,
        marginBottom: SPACING.xs,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: FONT_SIZES.md,
        color: COLORS.textSecondary,
        textAlign: 'center',
    },
    features: {
        paddingHorizontal: SPACING.xl,
        marginBottom: SPACING.xl,
    },
    pricingContainer: {
        paddingHorizontal: SPACING.xl,
        marginBottom: SPACING.xl,
    },
    priceCard: {
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.xl,
        padding: SPACING.lg,
        alignItems: 'center',
        borderWidth: 2,
        borderColor: COLORS.primary,
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    period: {
        fontSize: FONT_SIZES.md,
        color: COLORS.textSecondary,
        fontWeight: '600',
        marginBottom: 4,
    },
    price: {
        fontSize: 32,
        fontWeight: 'bold',
        color: COLORS.text,
        marginBottom: 4,
    },
    perMonth: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.textLight,
    },
    subscribeButton: {
        backgroundColor: COLORS.primary,
        marginHorizontal: SPACING.xl,
        paddingVertical: 16,
        borderRadius: BORDER_RADIUS.full,
        alignItems: 'center',
        marginBottom: SPACING.md,
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    subscribeText: {
        color: COLORS.surface,
        fontSize: FONT_SIZES.lg,
        fontWeight: 'bold',
    },
    restoreButton: {
        alignItems: 'center',
        marginBottom: SPACING.lg,
        padding: SPACING.sm,
    },
    restoreText: {
        color: COLORS.textSecondary,
        fontSize: FONT_SIZES.sm,
        fontWeight: '600',
    },
    disclaimer: {
        fontSize: 10,
        color: COLORS.textLight,
        textAlign: 'center',
        paddingHorizontal: SPACING.xl,
        lineHeight: 14,
    },
});
