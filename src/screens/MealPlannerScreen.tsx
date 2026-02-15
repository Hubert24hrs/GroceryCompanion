import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, StatusBar, Modal, TouchableOpacity, FlatList } from 'react-native';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../utils/constants';
import { WeekCalendar } from '../components/planner/WeekCalendar';
import { MealSlot } from '../components/planner/MealSlot';
import { useMealPlanStore } from '../store/useMealPlanStore';
import { MealType, Recipe } from '../types';
import { RECIPES } from '../data/recipes';
import { Ionicons } from '@expo/vector-icons';
import { RecipeCard } from '../components/recipes/RecipeCard';

export function MealPlannerScreen() {
    // Default to today formatted as YYYY-MM-DD
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const { meals, addMeal, removeMeal, getMealsForDate } = useMealPlanStore();

    // Modal state
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [activeMealType, setActiveMealType] = useState<MealType | null>(null);

    const todaysMeals = getMealsForDate(selectedDate);

    const getMealEntry = (type: MealType) => todaysMeals.find(m => m.type === type);

    const handleAddPress = (type: MealType) => {
        setActiveMealType(type);
        setIsModalVisible(true);
    };

    const handleSelectRecipe = (recipe: Recipe) => {
        if (activeMealType) {
            addMeal(selectedDate, activeMealType, recipe.id);
            setIsModalVisible(false);
            setActiveMealType(null);
        }
    };

    const handleRemoveMeal = (type: MealType) => {
        const entry = getMealEntry(type);
        if (entry) {
            removeMeal(entry.id);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

            <View style={styles.header}>
                <Text style={styles.headerTitle}>Meal Planner</Text>
                <Text style={styles.headerSubtitle}>Plan your week ahead</Text>
            </View>

            <View style={{ height: 100 }}>
                <WeekCalendar selectedDate={selectedDate} onSelectDate={setSelectedDate} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <MealSlot
                    title="Breakfast"
                    mealEntry={getMealEntry('breakfast')}
                    onAdd={() => handleAddPress('breakfast')}
                    onRemove={() => handleRemoveMeal('breakfast')}
                />
                <MealSlot
                    title="Lunch"
                    mealEntry={getMealEntry('lunch')}
                    onAdd={() => handleAddPress('lunch')}
                    onRemove={() => handleRemoveMeal('lunch')}
                />
                <MealSlot
                    title="Dinner"
                    mealEntry={getMealEntry('dinner')}
                    onAdd={() => handleAddPress('dinner')}
                    onRemove={() => handleRemoveMeal('dinner')}
                />
                <MealSlot
                    title="Snack"
                    mealEntry={getMealEntry('snack')}
                    onAdd={() => handleAddPress('snack')}
                    onRemove={() => handleRemoveMeal('snack')}
                />
            </ScrollView>

            {/* Recipe Selection Modal */}
            <Modal
                visible={isModalVisible}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setIsModalVisible(false)}
            >
                <SafeAreaView style={styles.modalContainer}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Select a Meal</Text>
                        <TouchableOpacity onPress={() => setIsModalVisible(false)}>
                            <Ionicons name="close" size={28} color={COLORS.text} />
                        </TouchableOpacity>
                    </View>

                    <FlatList
                        data={RECIPES}
                        keyExtractor={item => item.id}
                        contentContainerStyle={styles.modalContent}
                        renderItem={({ item }) => (
                            <RecipeCard
                                recipe={item}
                                variant="horizontal"
                                onPress={() => handleSelectRecipe(item)}
                            />
                        )}
                    />
                </SafeAreaView>
            </Modal>
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
        paddingBottom: SPACING.xs,
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
        marginBottom: SPACING.xs,
    },
    content: {
        padding: SPACING.lg,
    },

    // Modal Styles
    modalContainer: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: SPACING.lg,
        borderBottomWidth: 1,
        borderColor: COLORS.divider,
    },
    modalTitle: {
        fontSize: FONT_SIZES.xl,
        fontWeight: 'bold',
        color: COLORS.text,
    },
    modalContent: {
        padding: SPACING.lg,
    }
});
