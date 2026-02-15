import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, SafeAreaView, StatusBar, ScrollView } from 'react-native';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../utils/constants';
import { RECIPES } from '../data/recipes';
import { Recipe } from '../types';
import { SearchBar } from '../components/common/SearchBar';
import { CategoryFilter } from '../components/recipes/CategoryFilter';
import { RecipeCard } from '../components/recipes/RecipeCard';

interface RecipesScreenProps {
    navigation: any;
}

const CATEGORIES = ['Breakfast', 'Dinner', 'Italian', 'Healthy', 'Quick', 'Vegetarian', 'Mexican'];

export function RecipesScreen({ navigation }: RecipesScreenProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

    const handleRecipePress = (recipe: Recipe) => {
        navigation.navigate('RecipeDetail', { recipeId: recipe.id });
    };

    const filteredRecipes = useMemo(() => {
        return RECIPES.filter(recipe => {
            const matchesSearch = recipe.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                recipe.ingredients.some(ing => ing.name.toLowerCase().includes(searchQuery.toLowerCase()));
            const matchesCategory = selectedCategory ? recipe.tags.includes(selectedCategory) : true;
            return matchesSearch && matchesCategory;
        });
    }, [searchQuery, selectedCategory]);

    const featuredRecipes = useMemo(() => {
        return RECIPES.filter(r => r.isFavorite).slice(0, 5);
    }, []);

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

            <View style={styles.header}>
                <Text style={styles.headerTitle}>Discover</Text>
                <Text style={styles.headerSubtitle}>Find your next favorite meal</Text>
                <View style={styles.searchContainer}>
                    <SearchBar
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        placeholder="Search recipes, ingredients..."
                    />
                </View>
            </View>

            <View style={styles.filterContainer}>
                <CategoryFilter
                    categories={CATEGORIES}
                    selectedCategory={selectedCategory}
                    onSelect={setSelectedCategory}
                />
            </View>

            <FlatList
                data={filteredRecipes}
                keyExtractor={item => item.id}
                numColumns={2}
                columnWrapperStyle={styles.columnWrapper}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                ListHeaderComponent={
                    !searchQuery && !selectedCategory ? (
                        <View style={styles.featuredSection}>
                            <Text style={styles.sectionTitle}>Featured Collections</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.featuredScroll}>
                                {featuredRecipes.map(recipe => (
                                    <View key={recipe.id} style={{ marginRight: SPACING.md }}>
                                        <RecipeCard
                                            recipe={recipe}
                                            onPress={() => handleRecipePress(recipe)}
                                            variant="vertical"
                                        />
                                    </View>
                                ))}
                            </ScrollView>
                            <Text style={styles.sectionTitle}>All Recipes</Text>
                        </View>
                    ) : null
                }
                renderItem={({ item }) => (
                    <RecipeCard
                        recipe={item}
                        onPress={() => handleRecipePress(item)}
                        variant="vertical"
                    />
                )}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>No recipes found matching your criteria.</Text>
                    </View>
                }
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    header: {
        padding: SPACING.lg,
        paddingBottom: SPACING.sm,
        backgroundColor: COLORS.background,
    },
    headerTitle: {
        fontSize: FONT_SIZES.xxl,
        fontWeight: 'bold',
        color: COLORS.text,
    },
    headerSubtitle: {
        fontSize: FONT_SIZES.md,
        color: COLORS.textSecondary,
        marginBottom: SPACING.md,
    },
    searchContainer: {
        marginBottom: SPACING.xs,
    },
    filterContainer: {
        marginBottom: SPACING.sm,
    },
    listContent: {
        paddingHorizontal: SPACING.lg,
        paddingBottom: SPACING.xl,
    },
    columnWrapper: {
        justifyContent: 'space-between',
    },
    featuredSection: {
        marginBottom: SPACING.md,
    },
    sectionTitle: {
        fontSize: FONT_SIZES.xl,
        fontWeight: 'bold',
        color: COLORS.text,
        marginBottom: SPACING.md,
        marginTop: SPACING.sm,
    },
    featuredScroll: {
        marginBottom: SPACING.lg,
    },
    emptyContainer: {
        padding: SPACING.xl,
        alignItems: 'center',
    },
    emptyText: {
        color: COLORS.textSecondary,
        fontSize: FONT_SIZES.md,
    },
});
