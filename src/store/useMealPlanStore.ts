import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MealPlanEntry, MealType } from '../types';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

interface MealPlanState {
    meals: MealPlanEntry[];
    addMeal: (date: string, type: MealType, recipeId: string) => void;
    removeMeal: (id: string) => void;
    getMealsForDate: (date: string) => MealPlanEntry[];
}

export const useMealPlanStore = create<MealPlanState>()(
    persist(
        (set, get) => ({
            meals: [],
            addMeal: (date, type, recipeId) => {
                set((state) => ({
                    meals: [
                        ...state.meals,
                        {
                            id: uuidv4(),
                            date,
                            type,
                            recipeId,
                        },
                    ],
                }));
            },
            removeMeal: (id) => {
                set((state) => ({
                    meals: state.meals.filter((m) => m.id !== id),
                }));
            },
            getMealsForDate: (date) => {
                return get().meals.filter((m) => m.date === date);
            },
        }),
        {
            name: 'grocery-companion-meal-plan',
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);
