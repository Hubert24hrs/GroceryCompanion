import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZES } from '../../utils/constants';

interface PremiumFeatureRowProps {
    icon: keyof typeof Ionicons.glyphMap;
    text: string;
}

export function PremiumFeatureRow({ icon, text }: PremiumFeatureRowProps) {
    return (
        <View style={styles.container}>
            <View style={styles.iconContainer}>
                <Ionicons name={icon} size={24} color={COLORS.primary} />
            </View>
            <Text style={styles.text}>{text}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: SPACING.md,
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: COLORS.secondary,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: SPACING.md,
    },
    text: {
        fontSize: FONT_SIZES.md,
        color: COLORS.text,
        fontWeight: '500',
    },
});
