import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, SPACING, FONT_SIZES } from '../../utils/constants';

export function AdBanner() {
    // Ads are disabled on web to prevent native crashes
    return (
        <View style={styles.container}>
            <Text style={styles.text}>Grocery Companion Premium - Ad Free on Web</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.surface,
        paddingVertical: SPACING.sm,
        borderTopWidth: 1,
        borderTopColor: COLORS.divider,
    },
    text: {
        fontSize: FONT_SIZES.xs,
        color: COLORS.textLight,
        fontStyle: 'italic',
    },
});
