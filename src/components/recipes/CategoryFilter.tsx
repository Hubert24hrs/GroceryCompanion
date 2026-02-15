import React from 'react';
import { ScrollView, TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES } from '../../utils/constants';

interface CategoryFilterProps {
    categories: string[];
    selectedCategory: string | null;
    onSelect: (category: string | null) => void;
}

export function CategoryFilter({ categories, selectedCategory, onSelect }: CategoryFilterProps) {
    return (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.container}
        >
            <TouchableOpacity
                style={[
                    styles.pill,
                    selectedCategory === null && styles.pillActive
                ]}
                onPress={() => onSelect(null)}
            >
                <Text style={[
                    styles.pillText,
                    selectedCategory === null && styles.pillTextActive
                ]}>All</Text>
            </TouchableOpacity>

            {categories.map((category) => (
                <TouchableOpacity
                    key={category}
                    style={[
                        styles.pill,
                        selectedCategory === category && styles.pillActive
                    ]}
                    onPress={() => onSelect(category === selectedCategory ? null : category)}
                >
                    <Text style={[
                        styles.pillText,
                        selectedCategory === category && styles.pillTextActive
                    ]}>{category}</Text>
                </TouchableOpacity>
            ))}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.sm,
        gap: SPACING.sm,
    },
    pill: {
        paddingHorizontal: SPACING.md,
        paddingVertical: 8,
        borderRadius: BORDER_RADIUS.full,
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.divider,
    },
    pillActive: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
    },
    pillText: {
        fontSize: FONT_SIZES.sm,
        fontWeight: '600',
        color: COLORS.textSecondary,
    },
    pillTextActive: {
        color: COLORS.surface,
    },
});
