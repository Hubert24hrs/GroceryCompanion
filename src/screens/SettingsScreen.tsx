import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, ScrollView, Switch, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../utils/constants';
import { Button } from '../components/common/Button';
import { useUserStore } from '../store/useUserStore';
import { syncEngine } from '../services/sync/syncEngine';

export function SettingsScreen() {
    const { user, signOut } = useUserStore();
    const [syncing, setSyncing] = useState(false);

    const handleSignOut = async () => {
        Alert.alert(
            'Sign Out',
            'Are you sure you want to sign out?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Sign Out',
                    style: 'destructive',
                    onPress: async () => {
                        await signOut();
                        // Navigation handled by AppNavigator
                    }
                },
            ]
        );
    };

    const handleManualSync = async () => {
        setSyncing(true);
        try {
            await syncEngine.processQueue();
            await syncEngine.pullRemoteChanges();
            Alert.alert('Success', 'Sync completed successfully');
        } catch (error) {
            Alert.alert('Sync Failed', (error as Error).message);
        } finally {
            setSyncing(false);
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['bottom']}>
            <ScrollView contentContainerStyle={styles.content}>

                {/* Profile Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Account</Text>
                    <View style={styles.card}>
                        <View style={styles.row}>
                            <Text style={styles.label}>Email</Text>
                            <Text style={styles.value}>{user?.email || 'Guest User'}</Text>
                        </View>
                        <View style={styles.divider} />
                        <View style={styles.row}>
                            <Text style={styles.label}>User ID</Text>
                            <Text style={styles.value} numberOfLines={1} ellipsizeMode="middle">
                                {user?.id || 'Anonymous'}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Sync Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Data & Sync</Text>
                    <View style={styles.card}>
                        <View style={styles.row}>
                            <View>
                                <Text style={styles.itemTitle}>Sync Status</Text>
                                <Text style={styles.itemSubtitle}>Last synced: Just now</Text>
                            </View>
                            <Button
                                title="Sync Now"
                                size="small"
                                variant="outline"
                                loading={syncing}
                                onPress={handleManualSync}
                            />
                        </View>
                    </View>
                    <Text style={styles.hint}>
                        Data automatically syncs when you're online.
                    </Text>
                </View>

                {/* Preferences Section (Placeholder) */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Preferences</Text>
                    <View style={styles.card}>
                        <View style={styles.row}>
                            <Text style={styles.itemTitle}>Haptic Feedback</Text>
                            <Switch value={true} onValueChange={() => { }} trackColor={{ true: COLORS.primary }} />
                        </View>
                        <View style={styles.divider} />
                        <View style={styles.row}>
                            <Text style={styles.itemTitle}>Dark Mode</Text>
                            <Switch value={false} onValueChange={() => { }} trackColor={{ true: COLORS.primary }} />
                        </View>
                    </View>
                </View>

                <Button
                    title="Sign Out"
                    variant="ghost"
                    style={styles.signOutButton}
                    onPress={handleSignOut}
                />

                <Text style={styles.version}>Version 1.0.0 (Build 1)</Text>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    content: {
        padding: SPACING.lg,
    },
    section: {
        marginBottom: SPACING.xl,
    },
    sectionTitle: {
        fontSize: FONT_SIZES.md,
        fontWeight: '600',
        color: COLORS.textSecondary,
        marginBottom: SPACING.sm,
        marginLeft: SPACING.xs,
        textTransform: 'uppercase',
    },
    card: {
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.lg,
        overflow: 'hidden',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: SPACING.md,
        minHeight: 56,
    },
    divider: {
        height: 1,
        backgroundColor: COLORS.divider,
        marginLeft: SPACING.md,
    },
    label: {
        fontSize: FONT_SIZES.md,
        color: COLORS.text,
    },
    value: {
        fontSize: FONT_SIZES.md,
        color: COLORS.textSecondary,
        maxWidth: '60%',
    },
    itemTitle: {
        fontSize: FONT_SIZES.md,
        color: COLORS.text,
        fontWeight: '500',
    },
    itemSubtitle: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.textSecondary,
        marginTop: 2,
    },
    hint: {
        fontSize: FONT_SIZES.xs,
        color: COLORS.textSecondary,
        marginTop: SPACING.sm,
        marginLeft: SPACING.xs,
    },
    signOutButton: {
        marginTop: SPACING.lg,
    },
    version: {
        textAlign: 'center',
        color: COLORS.textLight,
        fontSize: FONT_SIZES.sm,
        marginTop: SPACING.xl,
        marginBottom: SPACING.xl,
    },
});
