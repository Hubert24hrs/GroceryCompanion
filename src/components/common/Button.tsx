import React from 'react';
import {
    TouchableOpacity,
    Text,
    StyleSheet,
    ActivityIndicator,
    TouchableOpacityProps,
    ViewStyle,
    TextStyle,
} from 'react-native';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../utils/constants';

interface ButtonProps extends TouchableOpacityProps {
    title: string;
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
    size?: 'small' | 'medium' | 'large';
    loading?: boolean;
    icon?: React.ReactNode;
    fullWidth?: boolean;
}

const variantButtonStyles = {
    primary: { backgroundColor: COLORS.primary },
    secondary: { backgroundColor: COLORS.secondary },
    outline: { backgroundColor: 'transparent', borderWidth: 2, borderColor: COLORS.primary },
    ghost: { backgroundColor: 'transparent' },
};

const sizeButtonStyles = {
    small: { paddingVertical: SPACING.xs, paddingHorizontal: SPACING.md, minHeight: 36 },
    medium: { paddingVertical: SPACING.sm, paddingHorizontal: SPACING.lg, minHeight: 48 },
    large: { paddingVertical: SPACING.md, paddingHorizontal: SPACING.xl, minHeight: 56 },
};

const variantTextStyles = {
    primary: { color: COLORS.surface },
    secondary: { color: COLORS.surface },
    outline: { color: COLORS.primary },
    ghost: { color: COLORS.primary },
};

const sizeTextStyles = {
    small: { fontSize: FONT_SIZES.sm },
    medium: { fontSize: FONT_SIZES.md },
    large: { fontSize: FONT_SIZES.lg },
};

export function Button({
    title,
    variant = 'primary',
    size = 'medium',
    loading = false,
    icon,
    fullWidth = false,
    disabled,
    style,
    ...props
}: ButtonProps) {
    const buttonStyles: ViewStyle[] = [
        styles.base,
        variantButtonStyles[variant] as ViewStyle,
        sizeButtonStyles[size] as ViewStyle,
        fullWidth ? styles.fullWidth : {},
        disabled ? styles.disabled : {},
        style as ViewStyle,
    ].filter(Boolean);

    const textStyles: TextStyle[] = [
        styles.text,
        variantTextStyles[variant] as TextStyle,
        sizeTextStyles[size] as TextStyle,
        disabled ? styles.disabledText : {},
    ].filter(Boolean);

    return (
        <TouchableOpacity
            style={buttonStyles}
            disabled={disabled || loading}
            activeOpacity={0.7}
            {...props}
        >
            {loading ? (
                <ActivityIndicator
                    color={variant === 'primary' ? COLORS.surface : COLORS.primary}
                    size="small"
                />
            ) : (
                <>
                    {icon}
                    <Text style={textStyles}>{title}</Text>
                </>
            )}
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    base: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: BORDER_RADIUS.lg,
        gap: SPACING.sm,
    },
    fullWidth: {
        width: '100%',
    },
    disabled: {
        opacity: 0.5,
    },
    text: {
        fontWeight: '600',
    },
    disabledText: {
        color: COLORS.textLight,
    },
});
