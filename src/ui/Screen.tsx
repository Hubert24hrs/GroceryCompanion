import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from './primitives';
import { spacing, useTheme } from './theme';

/** Large-title header used by the tab screens. */
export function ScreenHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
    const insets = useSafeAreaInsets();
    return (
        <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
            <View style={{ flex: 1 }}>
                {subtitle ? (
                    <Text variant="label" muted>
                        {subtitle}
                    </Text>
                ) : null}
                <Text variant="title" accessibilityRole="header">
                    {title}
                </Text>
            </View>
            {right ? <View style={styles.right}>{right}</View> : null}
        </View>
    );
}

/** Scrollable tab-screen body with the standard header. */
export function TabScreen({ title, subtitle, right, children }: {
    title: string;
    subtitle?: string;
    right?: React.ReactNode;
    children: React.ReactNode;
}) {
    const { colors } = useTheme();
    return (
        <View style={[styles.root, { backgroundColor: colors.background }]}>
            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                <ScreenHeader title={title} subtitle={subtitle} right={right} />
                <View style={styles.body}>{children}</View>
            </ScrollView>
        </View>
    );
}

export const layout = StyleSheet.create({
    page: { width: '100%', maxWidth: 760, alignSelf: 'center' },
});

const styles = StyleSheet.create({
    root: { flex: 1 },
    content: { paddingBottom: 120, ...layout.page },
    header: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.md },
    right: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    body: { paddingHorizontal: spacing.lg, gap: spacing.xl },
});
