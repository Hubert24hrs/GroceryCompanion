import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES } from '../../utils/constants';
import { Recipe } from '../../types';

interface RecipeCardProps {
    recipe: Recipe;
    onPress: () => void;
    variant?: 'vertical' | 'horizontal' | 'compact';
}

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - SPACING.lg * 3) / 2; // for 2-column grid

export function RecipeCard({ recipe, onPress, variant = 'vertical' }: RecipeCardProps) {
    if (variant === 'horizontal') {
        return (
            <TouchableOpacity style={styles.horizontalCard} onPress={onPress} activeOpacity={0.9}>
                <Image source={{ uri: recipe.image }} style={styles.horizontalImage} />
                <View style={styles.horizontalContent}>
                    <Text style={styles.title} numberOfLines={1}>{recipe.title}</Text>

                    <View style={styles.statsRow}>
                        <View style={styles.stat}>
                            <Ionicons name="time-outline" size={14} color={COLORS.textSecondary} />
                            <Text style={styles.statText}>{recipe.prepTime + recipe.cookTime} m</Text>
                        </View>
                        <View style={styles.stat}>
                            <Ionicons name="flame-outline" size={14} color={COLORS.textSecondary} />
                            <Text style={styles.statText}>{recipe.calories} kcal</Text>
                        </View>
                    </View>

                    <View style={styles.tagsRow}>
                        {recipe.tags.slice(0, 2).map((tag, i) => (
                            <View key={i} style={styles.miniTag}>
                                <Text style={styles.miniTagText}>{tag}</Text>
                            </View>
                        ))}
                    </View>
                </View>
            </TouchableOpacity>
        );
    }

    return (
        <TouchableOpacity
            style={[styles.verticalCard, { width: CARD_WIDTH }]}
            onPress={onPress}
            activeOpacity={0.9}
        >
            <View style={styles.imageContainer}>
                <Image source={{ uri: recipe.image }} style={styles.verticalImage} />
                {recipe.isFavorite && (
                    <View style={styles.favoriteBadge}>
                        <Ionicons name="heart" size={12} color={COLORS.surface} />
                    </View>
                )}
            </View>

            <View style={styles.verticalContent}>
                <Text style={styles.title} numberOfLines={2}>{recipe.title}</Text>

                <View style={styles.statsRow}>
                    <Text style={styles.statText}>⏱️ {recipe.prepTime + recipe.cookTime}m</Text>
                    <Text style={styles.dot}>•</Text>
                    <Text style={styles.statText}>{recipe.calories} kcal</Text>
                </View>
            </View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    // Vertical / Grid Card
    verticalCard: {
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.lg,
        marginBottom: SPACING.md,
        overflow: 'hidden',
        // Shadow
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    imageContainer: {
        position: 'relative',
    },
    verticalImage: {
        width: '100%',
        height: 120,
        backgroundColor: COLORS.secondary,
    },
    favoriteBadge: {
        position: 'absolute',
        top: 8,
        right: 8,
        backgroundColor: 'rgba(255, 100, 100, 0.9)',
        padding: 4,
        borderRadius: BORDER_RADIUS.full,
    },
    verticalContent: {
        padding: SPACING.sm,
    },
    title: {
        fontSize: FONT_SIZES.sm,
        fontWeight: 'bold',
        color: COLORS.text,
        marginBottom: 4,
    },
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    statText: {
        fontSize: FONT_SIZES.xs,
        color: COLORS.textSecondary,
    },
    dot: {
        fontSize: FONT_SIZES.xs,
        color: COLORS.textLight,
    },

    // Horizontal Card
    horizontalCard: {
        flexDirection: 'row',
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.lg,
        marginBottom: SPACING.md,
        padding: SPACING.sm,
        gap: SPACING.md,
    },
    horizontalImage: {
        width: 80,
        height: 80,
        borderRadius: BORDER_RADIUS.md,
        backgroundColor: COLORS.secondary,
    },
    horizontalContent: {
        flex: 1,
        justifyContent: 'center',
    },
    stat: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
    },
    tagsRow: {
        flexDirection: 'row',
        gap: 4,
        marginTop: 6,
    },
    miniTag: {
        backgroundColor: COLORS.secondary,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    miniTagText: {
        fontSize: 10,
        color: COLORS.text,
        fontWeight: '500',
    },
});
