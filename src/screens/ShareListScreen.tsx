import React from 'react';
import { View, Text, StyleSheet, Share, Alert, ScrollView } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../utils/constants';
import { Button } from '../components/common/Button';
import { useListStore } from '../store/useListStore';

type Props = NativeStackScreenProps<RootStackParamList, 'ShareList'>;

export function ShareListScreen({ route, navigation }: Props) {
    const { listId } = route.params;
    const lists = useListStore(state => state.lists);
    const list = lists.find(l => l.id === listId);

    const inviteLink = `https://grocerycompanion.app/join/${listId}`;

    const handleShare = async () => {
        try {
            const result = await Share.share({
                message: `Join my shopping list "${list?.name}" on Grocery Companion: ${inviteLink}`,
                url: inviteLink, // iOS only
                title: 'Join Shopping List',
            });

            if (result.action === Share.sharedAction) {
                if (result.activityType) {
                    // shared with activity type of result.activityType
                } else {
                    // shared
                }
            }
        } catch (error) {
            Alert.alert('Error', (error as Error).message);
        }
    };

    if (!list) {
        return (
            <View style={styles.container}>
                <Text>List not found</Text>
            </View>
        );
    }

    return (
        <ScrollView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Invite Collaborators</Text>
                <Text style={styles.subtitle}>
                    Share this list with family or roommates to shop together in real-time.
                </Text>
            </View>

            <View style={styles.card}>
                <Text style={styles.label}>Invite Link</Text>
                <View style={styles.linkContainer}>
                    <Text style={styles.linkText} numberOfLines={1}>{inviteLink}</Text>
                </View>
                <Button
                    title="Share Invite Link"
                    onPress={handleShare}
                    icon={<Text style={{ fontSize: 18 }}>📤</Text>}
                />
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Members</Text>
                <View style={styles.memberRow}>
                    <View style={styles.avatar}>
                        <Text style={styles.avatarText}>You</Text>
                    </View>
                    <View>
                        <Text style={styles.memberName}>You (Owner)</Text>
                        <Text style={styles.memberStatus}>Online</Text>
                    </View>
                </View>

                {/* Placeholder for other members */}
                <Text style={styles.emptyText}>No one else has joined yet.</Text>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    header: {
        padding: SPACING.xl,
        backgroundColor: COLORS.surface,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.divider,
    },
    title: {
        fontSize: FONT_SIZES.xl,
        fontWeight: '600',
        color: COLORS.text,
        marginBottom: SPACING.xs,
    },
    subtitle: {
        fontSize: FONT_SIZES.md,
        color: COLORS.textSecondary,
        lineHeight: 20,
    },
    card: {
        margin: SPACING.lg,
        padding: SPACING.lg,
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.lg,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    label: {
        fontSize: FONT_SIZES.sm,
        fontWeight: '600',
        color: COLORS.textSecondary,
        marginBottom: SPACING.sm,
    },
    linkContainer: {
        backgroundColor: COLORS.background,
        padding: SPACING.md,
        borderRadius: BORDER_RADIUS.md,
        marginBottom: SPACING.lg,
        borderWidth: 1,
        borderColor: COLORS.divider,
    },
    linkText: {
        color: COLORS.primary,
        fontFamily: 'monospace',
    },
    section: {
        padding: SPACING.lg,
    },
    sectionTitle: {
        fontSize: FONT_SIZES.lg,
        fontWeight: '600',
        marginBottom: SPACING.md,
        color: COLORS.text,
    },
    memberRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: SPACING.md,
        backgroundColor: COLORS.surface,
        padding: SPACING.md,
        borderRadius: BORDER_RADIUS.md,
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: COLORS.primary + '20',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: SPACING.md,
    },
    avatarText: {
        color: COLORS.primary,
        fontWeight: 'bold',
        fontSize: FONT_SIZES.xs,
    },
    memberName: {
        fontSize: FONT_SIZES.md,
        fontWeight: '600',
        color: COLORS.text,
    },
    memberStatus: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.success,
    },
    emptyText: {
        color: COLORS.textSecondary,
        fontStyle: 'italic',
        textAlign: 'center',
        marginTop: SPACING.sm,
    },
});
