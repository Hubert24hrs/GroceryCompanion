import React from 'react';
import { View, Text, StyleSheet, Image, ScrollView, TouchableOpacity, SafeAreaView, StatusBar, Alert } from 'react-native';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../utils/constants';
import { RECIPES } from '../data/recipes';
import { useListStore } from '../store/useListStore';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

interface RecipeDetailScreenProps {
    route: any;
    navigation: any;
}

export function RecipeDetailScreen({ route, navigation }: RecipeDetailScreenProps) {
    const { recipeId } = route.params;
    const recipe = RECIPES.find(r => r.id === recipeId);
    const { addItem, currentList } = useListStore();

    if (!recipe) {
        return (
            <View style={styles.errorContainer}>
                <Text>Recipe not found</Text>
            </View>
        );
    }

    const handleAddIngredients = async () => {
        if (!currentList) {
            Alert.alert('No List Selected', 'Please select a shopping list first.', [
                { text: 'Go to Lists', onPress: () => navigation.navigate('Lists') },
                { text: 'Cancel', style: 'cancel' }
            ]);
            return;
        }

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        // Add all ingredients
        let addedCount = 0;
        for (const ingredient of recipe.ingredients) {
            await addItem(
                ingredient.name,
                ingredient.category,
                ingredient.amount,
                ingredient.unit,
                undefined, // price
                `From recipe: ${recipe.title}`
            );
            addedCount++;
        }

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        Alert.alert(
            'Success',
            `Added ${addedCount} ingredients to ${currentList.name}`,
            [
                { text: 'View List', onPress: () => navigation.navigate('ListDetail', { listId: currentList.id }) },
                { text: 'Stay Here', style: 'cancel' }
            ]
        );
    };

    return (
        <ScrollView style={styles.container} bounces={false}>
            <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

            {/* Image Header */}
            <View style={styles.imageContainer}>
                <Image source={{ uri: recipe.image }} style={styles.image} />
                <View style={styles.overlay} />
                <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={24} color={COLORS.surface} />
                </TouchableOpacity>
                <View style={styles.headerContent}>
                    <Text style={styles.title}>{recipe.title}</Text>
                    <View style={styles.statsContainer}>
                        <View style={styles.stat}>
                            <Ionicons name="time-outline" size={16} color={COLORS.surface} />
                            <Text style={styles.statText}>{recipe.prepTime + recipe.cookTime} min</Text>
                        </View>
                        <View style={styles.stat}>
                            <Ionicons name="flame-outline" size={16} color={COLORS.surface} />
                            <Text style={styles.statText}>{recipe.calories} kcal</Text>
                        </View>
                        <View style={styles.stat}>
                            <Ionicons name="people-outline" size={16} color={COLORS.surface} />
                            <Text style={styles.statText}>{recipe.servings} servings</Text>
                        </View>
                    </View>
                </View>
            </View>

            <View style={styles.content}>
                {/* Description */}
                <Text style={styles.description}>{recipe.description}</Text>

                {/* Ingredients */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Ingredients</Text>
                    <TouchableOpacity style={styles.addButton} onPress={handleAddIngredients}>
                        <Ionicons name="add-circle-outline" size={20} color={COLORS.surface} />
                        <Text style={styles.addButtonText}>Add All to List</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.ingredientsList}>
                    {recipe.ingredients.map((ing, i) => (
                        <View key={i} style={styles.ingredientRow}>
                            <Text style={styles.bullet}>•</Text>
                            <Text style={styles.ingredientText}>
                                <Text style={styles.ingredientAmount}>{ing.amount} {ing.unit}</Text> {ing.name}
                            </Text>
                        </View>
                    ))}
                </View>

                {/* Instructions */}
                <Text style={styles.sectionTitle}>Instructions</Text>
                <View style={styles.instructionsList}>
                    {recipe.instructions.map((inst, i) => (
                        <View key={i} style={styles.instructionRow}>
                            <View style={styles.stepNumberContainer}>
                                <Text style={styles.stepNumber}>{i + 1}</Text>
                            </View>
                            <Text style={styles.instructionText}>{inst}</Text>
                        </View>
                    ))}
                </View>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    imageContainer: {
        height: 300,
        width: '100%',
        position: 'relative',
    },
    image: {
        width: '100%',
        height: '100%',
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.3)',
    },
    backButton: {
        position: 'absolute',
        top: 50,
        left: 20,
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerContent: {
        position: 'absolute',
        bottom: 20,
        left: 20,
        right: 20,
    },
    title: {
        fontSize: FONT_SIZES.xxl,
        fontWeight: 'bold',
        color: COLORS.surface,
        marginBottom: SPACING.sm,
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
    },
    statsContainer: {
        flexDirection: 'row',
        gap: SPACING.lg,
    },
    stat: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    statText: {
        color: COLORS.surface,
        fontWeight: '600',
        fontSize: FONT_SIZES.sm,
    },
    content: {
        flex: 1,
        backgroundColor: COLORS.background,
        borderTopLeftRadius: BORDER_RADIUS.xl,
        borderTopRightRadius: BORDER_RADIUS.xl,
        marginTop: -20,
        padding: SPACING.xl,
    },
    description: {
        fontSize: FONT_SIZES.md,
        color: COLORS.textSecondary,
        marginBottom: SPACING.xl,
        lineHeight: 24,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACING.md,
    },
    sectionTitle: {
        fontSize: FONT_SIZES.xl,
        fontWeight: 'bold',
        color: COLORS.text,
        marginBottom: SPACING.md,
        marginTop: SPACING.lg,
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.primary,
        paddingHorizontal: SPACING.md,
        paddingVertical: 8,
        borderRadius: BORDER_RADIUS.md,
        gap: 4,
    },
    addButtonText: {
        color: COLORS.surface,
        fontWeight: '600',
        fontSize: FONT_SIZES.sm,
    },
    ingredientsList: {
        marginBottom: SPACING.lg,
    },
    ingredientRow: {
        flexDirection: 'row',
        marginBottom: SPACING.sm,
        alignItems: 'center',
    },
    bullet: {
        color: COLORS.primary,
        fontSize: FONT_SIZES.lg,
        marginRight: SPACING.sm,
    },
    ingredientText: {
        fontSize: FONT_SIZES.md,
        color: COLORS.text,
    },
    ingredientAmount: {
        fontWeight: 'bold',
    },
    instructionsList: {
        paddingBottom: SPACING.xxl,
    },
    instructionRow: {
        flexDirection: 'row',
        marginBottom: SPACING.lg,
    },
    stepNumberContainer: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: COLORS.secondary,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: SPACING.md,
        marginTop: 2,
    },
    stepNumber: {
        color: COLORS.primary,
        fontWeight: 'bold',
        fontSize: FONT_SIZES.sm,
    },
    instructionText: {
        flex: 1,
        fontSize: FONT_SIZES.md,
        color: COLORS.text,
        lineHeight: 24,
    },
});
