import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React from 'react';
import {
    ActivityIndicator,
    Platform,
    Pressable,
    PressableProps,
    StyleProp,
    StyleSheet,
    Text as RNText,
    TextInput,
    TextInputProps,
    TextProps,
    View,
    ViewStyle,
} from 'react-native';
import { usePrefs } from '../state/prefs';
import { radius, spacing, type, useTheme } from './theme';

export type IconName = React.ComponentProps<typeof Ionicons>['name'];

export function tap() {
    if (Platform.OS !== 'web' && usePrefs.getState().prefs.haptics) void Haptics.selectionAsync().catch(() => undefined);
}

// ───────────────────────── text ─────────────────────────

interface AppTextProps extends TextProps {
    variant?: keyof typeof type;
    muted?: boolean;
    color?: string;
}

export function Text({ variant = 'body', muted, color, style, ...rest }: AppTextProps) {
    const { colors } = useTheme();
    return <RNText {...rest} style={[type[variant], { color: color ?? (muted ? colors.textMuted : colors.text) }, style]} />;
}

// ───────────────────────── surfaces ─────────────────────────

export function Card({ style, children, onPress, onLongPress, accessibilityLabel }: {
    style?: StyleProp<ViewStyle>;
    children: React.ReactNode;
    onPress?: () => void;
    onLongPress?: () => void;
    accessibilityLabel?: string;
}) {
    const { colors } = useTheme();
    const base = [styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, style];
    if (!onPress && !onLongPress) return <View style={base}>{children}</View>;
    return (
        <Pressable
            onPress={onPress}
            onLongPress={onLongPress}
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel}
            style={({ pressed }) => [base, pressed && { opacity: 0.85 }]}
        >
            {children}
        </Pressable>
    );
}

export function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
    const { colors } = useTheme();
    return (
        <View style={styles.sectionTitle}>
            <Text variant="subheading">{title}</Text>
            {action && onAction ? (
                <Pressable onPress={onAction} hitSlop={8} accessibilityRole="button">
                    <Text variant="label" color={colors.primary}>
                        {action}
                    </Text>
                </Pressable>
            ) : null}
        </View>
    );
}

export function ProgressBar({ value, color, track }: { value: number; color?: string; track?: string }) {
    const { colors } = useTheme();
    const pct = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
    return (
        <View style={[styles.progressTrack, { backgroundColor: track ?? colors.surfaceAlt }]}>
            <View style={[styles.progressFill, { width: `${pct * 100}%`, backgroundColor: color ?? colors.primary }]} />
        </View>
    );
}

// ───────────────────────── controls ─────────────────────────

type ButtonVariant = 'primary' | 'accent' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps extends Omit<PressableProps, 'style' | 'children'> {
    title: string;
    icon?: IconName;
    variant?: ButtonVariant;
    loading?: boolean;
    small?: boolean;
    style?: StyleProp<ViewStyle>;
}

export function Button({ title, icon, variant = 'primary', loading, small, disabled, style, onPress, ...rest }: ButtonProps) {
    const { colors } = useTheme();
    const palette: Record<ButtonVariant, { bg: string; fg: string; border?: string }> = {
        primary: { bg: colors.primary, fg: colors.onPrimary },
        accent: { bg: colors.accent, fg: colors.onAccent },
        secondary: { bg: colors.surface, fg: colors.text, border: colors.border },
        ghost: { bg: 'transparent', fg: colors.primary },
        danger: { bg: colors.dangerSoft, fg: colors.danger },
    };
    const p = palette[variant];
    const inactive = disabled || loading;
    return (
        <Pressable
            {...rest}
            disabled={inactive}
            accessibilityRole="button"
            accessibilityState={{ disabled: !!inactive, busy: !!loading }}
            onPress={e => {
                tap();
                onPress?.(e);
            }}
            style={({ pressed }) => [
                styles.button,
                small && styles.buttonSmall,
                { backgroundColor: p.bg, borderColor: p.border ?? p.bg, opacity: inactive ? 0.5 : pressed ? 0.85 : 1 },
                style,
            ]}
        >
            {loading ? (
                <ActivityIndicator color={p.fg} size="small" />
            ) : (
                <>
                    {icon ? <Ionicons name={icon} size={small ? 16 : 18} color={p.fg} /> : null}
                    <Text variant="label" color={p.fg} style={small ? { fontSize: 13 } : undefined}>
                        {title}
                    </Text>
                </>
            )}
        </Pressable>
    );
}

export function IconButton({ icon, onPress, label, color, size = 22, disabled, filled }: {
    icon: IconName;
    onPress: () => void;
    label: string;
    color?: string;
    size?: number;
    disabled?: boolean;
    filled?: boolean;
}) {
    const { colors } = useTheme();
    return (
        <Pressable
            onPress={onPress}
            disabled={disabled}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={label}
            style={({ pressed }) => [
                styles.iconButton,
                filled && { backgroundColor: colors.surfaceAlt },
                { opacity: disabled ? 0.4 : pressed ? 0.6 : 1 },
            ]}
        >
            <Ionicons name={icon} size={size} color={color ?? colors.text} />
        </Pressable>
    );
}

export function Chip({ label, selected, onPress, color, icon }: {
    label: string;
    selected?: boolean;
    onPress?: () => void;
    color?: string;
    icon?: IconName;
}) {
    const { colors } = useTheme();
    const tint = color ?? colors.primary;
    return (
        <Pressable
            onPress={onPress}
            accessibilityRole="button"
            accessibilityState={{ selected: !!selected }}
            style={({ pressed }) => [
                styles.chip,
                {
                    backgroundColor: selected ? tint : colors.surface,
                    borderColor: selected ? tint : colors.border,
                    opacity: pressed ? 0.8 : 1,
                },
            ]}
        >
            {icon ? <Ionicons name={icon} size={14} color={selected ? '#fff' : colors.textMuted} /> : null}
            <Text variant="caption" color={selected ? '#fff' : colors.text} style={{ fontWeight: '600' }}>
                {label}
            </Text>
        </Pressable>
    );
}

export function Field({ label, error, style, ...rest }: TextInputProps & { label?: string; error?: string | null }) {
    const { colors } = useTheme();
    return (
        <View style={styles.field}>
            {label ? (
                <Text variant="label" muted>
                    {label}
                </Text>
            ) : null}
            <TextInput
                placeholderTextColor={colors.textMuted}
                {...rest}
                style={[
                    styles.input,
                    { backgroundColor: colors.surfaceAlt, color: colors.text, borderColor: error ? colors.danger : 'transparent' },
                    style,
                ]}
            />
            {error ? (
                <Text variant="caption" color={colors.danger}>
                    {error}
                </Text>
            ) : null}
        </View>
    );
}

export function Banner({ tone = 'warning', icon, message, action, onAction }: {
    tone?: 'warning' | 'danger' | 'info';
    icon?: IconName;
    message: string;
    action?: string;
    onAction?: () => void;
}) {
    const { colors } = useTheme();
    const bg = tone === 'danger' ? colors.dangerSoft : tone === 'info' ? colors.primarySoft : colors.warningSoft;
    const fg = tone === 'danger' ? colors.danger : tone === 'info' ? colors.primary : colors.warning;
    return (
        <View style={[styles.banner, { backgroundColor: bg }]}>
            <Ionicons name={icon ?? 'alert-circle'} size={18} color={fg} />
            <Text variant="caption" style={{ flex: 1 }}>
                {message}
            </Text>
            {action && onAction ? (
                <Pressable onPress={onAction} hitSlop={8}>
                    <Text variant="label" color={fg}>
                        {action}
                    </Text>
                </Pressable>
            ) : null}
        </View>
    );
}

export function EmptyState({ icon, title, message, action, onAction }: {
    icon: IconName;
    title: string;
    message?: string;
    action?: string;
    onAction?: () => void;
}) {
    const { colors } = useTheme();
    return (
        <View style={styles.empty}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.primarySoft }]}>
                <Ionicons name={icon} size={32} color={colors.primary} />
            </View>
            <Text variant="heading" style={{ textAlign: 'center' }}>
                {title}
            </Text>
            {message ? (
                <Text muted style={{ textAlign: 'center', maxWidth: 320 }}>
                    {message}
                </Text>
            ) : null}
            {action && onAction ? <Button title={action} onPress={onAction} style={{ marginTop: spacing.sm }} /> : null}
        </View>
    );
}

const styles = StyleSheet.create({
    card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, padding: spacing.lg },
    sectionTitle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
    progressTrack: { height: 6, borderRadius: radius.pill, overflow: 'hidden' },
    progressFill: { height: '100%', borderRadius: radius.pill },
    button: {
        minHeight: 46,
        paddingHorizontal: spacing.lg,
        borderRadius: radius.md,
        borderWidth: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
    },
    buttonSmall: { minHeight: 34, paddingHorizontal: spacing.md, borderRadius: radius.sm },
    iconButton: { width: 38, height: 38, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: spacing.md,
        paddingVertical: 7,
        borderRadius: radius.pill,
        borderWidth: 1,
    },
    field: { gap: 6 },
    input: { minHeight: 46, borderRadius: radius.md, paddingHorizontal: spacing.md, fontSize: 16, borderWidth: 1 },
    banner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.md },
    empty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxl, paddingHorizontal: spacing.xl },
    emptyIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
});
