import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, IconName, Text } from './primitives';
import { radius, spacing, useTheme } from './theme';

/** Inline card for a Pro-only section. */
export function ProLock({ title, detail, onPress }: { title: string; detail: string; onPress: () => void }) {
    const { colors } = useTheme();
    return (
        <Card onPress={onPress} accessibilityLabel={`${title}. ${detail}. See Pro.`} style={[styles.lock, { backgroundColor: colors.accentSoft, borderColor: colors.accentSoft }]}>
            <Ionicons name="lock-closed" size={20} color={colors.accent} />
            <View style={{ flex: 1 }}>
                <Text variant="label">{title}</Text>
                <Text variant="caption" muted>
                    {detail}
                </Text>
            </View>
            <Text variant="label" color={colors.accent}>
                See Pro
            </Text>
        </Card>
    );
}

/** Whole-screen gate for a Pro-only feature, with what it does and how to unlock it. */
export function ProGate({ icon, title, detail, points, onPress }: {
    icon: IconName;
    title: string;
    detail: string;
    points: string[];
    onPress: () => void;
}) {
    const { colors } = useTheme();
    return (
        <ScrollView contentContainerStyle={styles.gate}>
            <View style={[styles.gateIcon, { backgroundColor: colors.accentSoft }]}>
                <Ionicons name={icon} size={34} color={colors.accent} />
            </View>
            <Text variant="heading" style={{ textAlign: 'center' }}>
                {title}
            </Text>
            <Text muted style={{ textAlign: 'center' }}>
                {detail}
            </Text>
            <Card style={{ gap: spacing.md, alignSelf: 'stretch' }}>
                {points.map(p => (
                    <View key={p} style={styles.point}>
                        <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                        <Text style={{ flex: 1 }}>{p}</Text>
                    </View>
                ))}
            </Card>
            <Button title="Unlock with Pro" icon="sparkles" variant="accent" onPress={onPress} style={{ alignSelf: 'stretch' }} />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    lock: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    gate: { alignItems: 'center', gap: spacing.lg, padding: spacing.xl, paddingTop: spacing.lg },
    gateIcon: { width: 72, height: 72, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
    point: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
