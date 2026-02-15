import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES } from '../../utils/constants';
import { Recipe, MealPlanEntry } from '../../types';
import { RECIPES } from '../../data/recipes';

interface MealSlotProps {
    title: string;
    mealEntry?: MealPlanEntry;
    onAdd: () => void;
    onRemove: () => void;
}

export function MealSlot({ title, mealEntry, onAdd, onRemove }: MealSlotProps) {
    const recipe = mealEntry ? RECIPES.find(r => r.id === mealEntry.recipeId) : null;

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>{title}</Text>
            </View>

            {recipe ? (
                <View style={styles.card}>
                    <Image source={{ uri: recipe.image }} style={styles.image} />
                    <View style={styles.content}>
                        <Text style={styles.recipeTitle} numberOfLines={1}>{recipe.title}</Text>
                        <Text style={styles.stats}>
                            {recipe.calories} kcal • {recipe.prepTime + recipe.cookTime} min
                        </Text>
                    </View>
                    <TouchableOpacity onPress={onRemove} style={styles.removeButton}>
                        <Ionicons name="close-circle" size={24} color={COLORS.textSecondary} />
                    </TouchableOpacity>
                </View>
            ) : (
                <TouchableOpacity style={styles.emptySlot} onPress={onAdd} activeOpacity={0.7}>
                    <View style={styles.addButton}>
                        <Ionicons name="add" size={24} color={COLORS.primary} />
                    </View>
                    <Text style={styles.addText}>Add {title}</Text>
                </TouchableOpacity>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: SPACING.lg,
    },
    header: {
        marginBottom: SPACING.sm,
    },
    title: {
        fontSize: FONT_SIZES.md,
        fontWeight: 'bold',
        color: COLORS.text,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    card: {
        flexDirection: 'row',
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.sm,
        alignItems: 'center',
        // Shadow
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    image: {
        width: 60,
        height: 60,
        borderRadius: BORDER_RADIUS.md,
        backgroundColor: COLORS.secondary,
    },
    content: {
        flex: 1,
        marginLeft: SPACING.md,
    },
    recipeTitle: {
        fontSize: FONT_SIZES.md,
        fontWeight: '600',
        color: COLORS.text,
        marginBottom: 4,
    },
    stats: {
        fontSize: FONT_SIZES.xs,
        color: COLORS.textSecondary,
    },
    removeButton: {
        padding: SPACING.sm,
    },
    emptySlot: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: SPACING.md,
        backgroundColor: COLORS.background, // contrasting slightly with white surface if needed, but transparent looks clean
        borderWidth: 2,
        borderColor: COLORS.divider,
        borderStyle: 'dashed',
        borderRadius: BORDER_RADIUS.lg,
        height: 80,
    },
    addButton: {
        width: 40,
        height: 40,
        borderRadius: BORDER_RADIUS.full,
        backgroundColor: COLORS.secondary,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: SPACING.md,
    },
    addText: {
        fontSize: FONT_SIZES.md,
        color: COLORS.textSecondary,
        fontWeight: '500',
    },
});
