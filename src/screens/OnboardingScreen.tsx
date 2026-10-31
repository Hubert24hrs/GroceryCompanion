import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '../state/session';
import { Button, IconName, Text } from '../ui/primitives';
import { radius, spacing, useTheme } from '../ui/theme';

const POINTS: { icon: IconName; title: string; detail: string }[] = [
    { icon: 'list', title: 'Lists sorted by aisle', detail: 'Type "2 lb chicken, milk, 6 eggs" and everything lands in the right section.' },
    { icon: 'file-tray-stacked', title: 'A pantry that remembers', detail: "Know what's running low or about to expire before you shop." },
    { icon: 'calendar', title: 'Plan the week, get the list', detail: 'Recipes on the calendar turn into one consolidated shopping list.' },
    { icon: 'people', title: 'Shop together', detail: 'Share your household so everyone shops from the same lists.' },
];

export function OnboardingScreen() {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const [busy, setBusy] = useState(false);

    return (
        <View style={[styles.root, { backgroundColor: colors.background }]}>
            <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xl }]}>
                <View style={[styles.logo, { backgroundColor: colors.primary }]}>
                    <Ionicons name="basket" size={40} color={colors.onPrimary} />
                </View>
                <Text variant="title" style={{ textAlign: 'center' }}>
                    Grocery Companion
                </Text>
                <Text muted style={{ textAlign: 'center' }}>
                    Your lists, pantry and meal plan in one calm place. Works offline, syncs when you sign in.
                </Text>
                <View style={styles.points}>
                    {POINTS.map(p => (
                        <View key={p.title} style={styles.point}>
                            <View style={[styles.pointIcon, { backgroundColor: colors.accentSoft }]}>
                                <Ionicons name={p.icon} size={20} color={colors.accent} />
                            </View>
                            <View style={{ flex: 1, gap: 2 }}>
                                <Text variant="subheading">{p.title}</Text>
                                <Text variant="caption" muted>
                                    {p.detail}
                                </Text>
                            </View>
                        </View>
                    ))}
                </View>
                <Button
                    title="Get started"
                    icon="arrow-forward"
                    loading={busy}
                    onPress={async () => {
                        setBusy(true);
                        await useSession.getState().completeOnboarding();
                    }}
                />
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1 },
    content: { paddingHorizontal: spacing.xl, gap: spacing.lg, maxWidth: 520, width: '100%', alignSelf: 'center' },
    logo: { width: 84, height: 84, borderRadius: radius.lg + 8, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
    points: { gap: spacing.lg, marginVertical: spacing.lg },
    point: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
    pointIcon: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
});
