import { MealType } from '../../domain/types';
import { IconName } from '../../ui/primitives';

export const MEAL_TYPES: { key: MealType; label: string; icon: IconName }[] = [
    { key: 'breakfast', label: 'Breakfast', icon: 'cafe-outline' },
    { key: 'lunch', label: 'Lunch', icon: 'sunny-outline' },
    { key: 'dinner', label: 'Dinner', icon: 'moon-outline' },
    { key: 'snack', label: 'Snack', icon: 'nutrition-outline' },
];

export const MEAL_ORDER: Record<MealType, number> = { breakfast: 0, lunch: 1, dinner: 2, snack: 3 };
export const MEAL_LABEL: Record<MealType, string> = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack' };

/** Weeks start on Monday in the planner. */
export const WEEK_STARTS_ON = 1;

/** A sensible default slot for "plan this" based on the time of day. */
export function defaultMealType(now = new Date()): MealType {
    const h = now.getHours();
    return h < 10 ? 'breakfast' : h < 15 ? 'lunch' : 'dinner';
}
