import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../utils/constants';
import { useUserStore } from '../store/useUserStore';
import { supabase } from '../services/sync/supabase';

export function PaywallScreen({ navigation }: any) {
    const { user } = useUserStore();
    const [isLoading, setIsLoading] = useState(false);

    const handlePurchase = async () => {
        if (!user) return;
        setIsLoading(true);

        try {
            // Simulate purchase delay
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Upgrade user in DB (This is temporary for MVP - strictly RLS should prevent this)
            // Ideally call a Cloud Function or verify receipt on backend
            const { error } = await supabase.rpc('upgrade_to_pro');

            if (error) {
                // Fallback if RPC doesn't exist yet (user didn't run migration)
                const { error: updateError } = await supabase
                    .from('profiles')
                    .update({ is_pro: true })
                    .eq('id', user.id);

                if (updateError) throw updateError;
            }

            Alert.alert('🎉 Success!', 'You are now a Pro member. Enjoy unlimited access!', [
                { text: 'OK', onPress: () => navigation.goBack() }
            ]);

            // Trigger store refresh (handled by onAuthStateChange logic or force reload)
            // For now, we rely on Realtime or next app start. 
            // Better: update valid session.

        } catch (error) {
            Alert.alert('Purchase Failed', (error as Error).message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleRestore = async () => {
        setIsLoading(true);
        setTimeout(() => {
            setIsLoading(false);
            Alert.alert('Restore', 'Purchases restored.');
        }, 1500);
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeButton}>
                    <Text style={styles.closeText}>✕</Text>
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.iconContainer}>
                    <Text style={styles.icon}>👑</Text>
                </View>

                <Text style={styles.title}>Unlock Grocery Pro</Text>
                <Text style={styles.subtitle}>
                    Get the ultimate shopping experience without limits.
                </Text>

                <View style={styles.features}>
                    <FeatureRow icon="📝" text="Unlimited Shopping Lists" />
                    <FeatureRow icon="👥" text="Unlimited Collaborators" />
                    <FeatureRow icon="☁️" text="Cloud Backup & Sync" />
                    <FeatureRow icon="🎨" text="Custom Themes & Icons" />
                    <FeatureRow icon="❤️" text="Support Indie Development" />
                </View>

                <View style={styles.pricingContainer}>
                    <Text style={styles.price}>$4.99</Text>
                    <Text style={styles.period}>One-time purchase</Text>
                </View>
            </ScrollView>

            <View style={styles.footer}>
                <TouchableOpacity
                    style={styles.purchaseButton}
                    onPress={handlePurchase}
                    disabled={isLoading}
                >
                    {isLoading ? (
                        <ActivityIndicator color="#FFF" />
                    ) : (
                        <Text style={styles.purchaseButtonText}>Upgrade Now</Text>
                    )}
                </TouchableOpacity>

                <TouchableOpacity onPress={handleRestore} disabled={isLoading}>
                    <Text style={styles.restoreText}>Restore Purchases</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

function FeatureRow({ icon, text }: { icon: string; text: string }) {
    return (
        <View style={styles.featureRow}>
            <Text style={styles.featureIcon}>{icon}</Text>
            <Text style={styles.featureText}>{text}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    header: {
        padding: SPACING.lg,
        alignItems: 'flex-end',
    },
    closeButton: {
        padding: SPACING.xs,
    },
    closeText: {
        fontSize: FONT_SIZES.xl,
        color: COLORS.textSecondary,
    },
    content: {
        padding: SPACING.xl,
        alignItems: 'center',
    },
    iconContainer: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: COLORS.primary + '20',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: SPACING.xl,
    },
    icon: {
        fontSize: 48,
    },
    title: {
        fontSize: FONT_SIZES.xxl,
        fontWeight: 'bold',
        color: COLORS.text,
        textAlign: 'center',
        marginBottom: SPACING.sm,
    },
    subtitle: {
        fontSize: FONT_SIZES.md,
        color: COLORS.textSecondary,
        textAlign: 'center',
        marginBottom: SPACING.xxl,
        paddingHorizontal: SPACING.lg,
    },
    features: {
        width: '100%',
        marginBottom: SPACING.xxl,
        backgroundColor: COLORS.surface,
        padding: SPACING.lg,
        borderRadius: BORDER_RADIUS.xl,
    },
    featureRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: SPACING.md,
    },
    featureIcon: {
        fontSize: FONT_SIZES.lg,
        marginRight: SPACING.md,
    },
    featureText: {
        fontSize: FONT_SIZES.md,
        color: COLORS.text,
        fontWeight: '500',
    },
    pricingContainer: {
        alignItems: 'center',
    },
    price: {
        fontSize: 48,
        fontWeight: 'bold',
        color: COLORS.primary,
    },
    period: {
        fontSize: FONT_SIZES.md,
        color: COLORS.textSecondary,
        fontWeight: '500',
    },
    footer: {
        padding: SPACING.xl,
        borderTopWidth: 1,
        borderTopColor: COLORS.divider,
        backgroundColor: COLORS.surface,
    },
    purchaseButton: {
        backgroundColor: COLORS.primary,
        paddingVertical: SPACING.lg,
        borderRadius: BORDER_RADIUS.full,
        alignItems: 'center',
        marginBottom: SPACING.lg,
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    purchaseButtonText: {
        color: '#FFFFFF',
        fontSize: FONT_SIZES.lg,
        fontWeight: 'bold',
    },
    restoreText: {
        textAlign: 'center',
        color: COLORS.textSecondary,
        fontSize: FONT_SIZES.sm,
    },
});
