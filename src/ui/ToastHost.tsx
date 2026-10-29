import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToast } from '../state/toast';
import { Text } from './primitives';
import { radius, spacing, useTheme } from './theme';

const ICONS = { info: 'information-circle', success: 'checkmark-circle', warning: 'alert-circle', error: 'close-circle' } as const;

/** Renders the current toast above the tab bar. Mounted once at the app root. */
export function ToastHost() {
    const current = useToast(s => s.current);
    const dismiss = useToast(s => s.dismiss);
    const { colors, dark } = useTheme();
    const insets = useSafeAreaInsets();
    if (!current) return null;
    const iconColor = { info: colors.primary, success: colors.primary, warning: colors.warning, error: colors.danger }[current.tone];
    return (
        <View pointerEvents="box-none" style={[styles.wrap, { bottom: insets.bottom + 72 }]}>
            <View
                accessibilityLiveRegion="polite"
                accessibilityRole="alert"
                style={[styles.toast, { backgroundColor: dark ? colors.surfaceAlt : '#1C2920' }]}
            >
                <Ionicons name={ICONS[current.tone]} size={20} color={iconColor} />
                <Text variant="caption" color={dark ? colors.text : '#F2F5F0'} style={{ flex: 1 }}>
                    {current.message}
                </Text>
                {current.actionLabel ? (
                    <Pressable
                        hitSlop={10}
                        onPress={() => {
                            current.onAction?.();
                            dismiss();
                        }}
                    >
                        <Text variant="label" color={colors.accent}>
                            {current.actionLabel}
                        </Text>
                    </Pressable>
                ) : null}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', paddingHorizontal: spacing.lg },
    toast: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderRadius: radius.md,
        width: '100%',
        maxWidth: 520,
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 6,
    },
});
