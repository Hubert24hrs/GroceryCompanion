import { Ionicons } from '@expo/vector-icons';
import { BottomTabScreenProps, createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
    CompositeScreenProps,
    DarkTheme,
    DefaultTheme,
    NavigationContainer,
    NavigatorScreenParams,
    Theme as NavTheme,
} from '@react-navigation/native';
import { createNativeStackNavigator, NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useMemo } from 'react';
import { HomeScreen } from '../screens/HomeScreen';
import { HouseholdScreen } from '../screens/HouseholdScreen';
import { ListDetailScreen } from '../screens/ListDetailScreen';
import { ListsScreen } from '../screens/ListsScreen';
import { MealPlanScreen } from '../screens/MealPlanScreen';
import { PantryFilter } from '../screens/pantry/pantryUi';
import { PantryScreen } from '../screens/PantryScreen';
import { ProScreen } from '../screens/ProScreen';
import { RecipeDetailScreen } from '../screens/RecipeDetailScreen';
import { RecipeEditScreen } from '../screens/RecipeEditScreen';
import { RecipesScreen } from '../screens/RecipesScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { IconName } from '../ui/primitives';
import { useTheme } from '../ui/theme';

export type TabParamList = {
    Home: undefined;
    Lists: undefined;
    Recipes: undefined;
    MealPlan: undefined;
    Pantry: { filter?: PantryFilter } | undefined;
};

export type RootStackParamList = {
    Tabs: NavigatorScreenParams<TabParamList> | undefined;
    ListDetail: { listId: string };
    RecipeDetail: { recipeId: string };
    RecipeEdit: { recipeId?: string };
    Settings: undefined;
    Household: undefined;
    Pro: undefined;
};

export type RootScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, T>;
export type TabScreenProps<T extends keyof TabParamList> = CompositeScreenProps<
    BottomTabScreenProps<TabParamList, T>,
    NativeStackScreenProps<RootStackParamList>
>;

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

const TAB_ICONS: Record<keyof TabParamList, [IconName, IconName]> = {
    Home: ['home', 'home-outline'],
    Lists: ['list', 'list-outline'],
    Recipes: ['book', 'book-outline'],
    MealPlan: ['calendar', 'calendar-outline'],
    Pantry: ['file-tray-stacked', 'file-tray-stacked-outline'],
};

function Tabs() {
    const { colors } = useTheme();
    return (
        <Tab.Navigator
            screenOptions={({ route }) => ({
                headerShown: false,
                tabBarActiveTintColor: colors.primary,
                tabBarInactiveTintColor: colors.textMuted,
                tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
                tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
                tabBarIcon: ({ focused, color, size }) => (
                    <Ionicons name={TAB_ICONS[route.name][focused ? 0 : 1]} size={size} color={color} />
                ),
            })}
        >
            <Tab.Screen name="Home" component={HomeScreen} />
            <Tab.Screen name="Lists" component={ListsScreen} />
            <Tab.Screen name="Recipes" component={RecipesScreen} />
            <Tab.Screen name="MealPlan" component={MealPlanScreen} options={{ title: 'Meal Plan' }} />
            <Tab.Screen name="Pantry" component={PantryScreen} />
        </Tab.Navigator>
    );
}

export function RootNavigator() {
    const { dark, colors } = useTheme();
    const navTheme: NavTheme = useMemo(() => {
        const base = dark ? DarkTheme : DefaultTheme;
        return {
            ...base,
            colors: {
                ...base.colors,
                primary: colors.primary,
                background: colors.background,
                card: colors.surface,
                text: colors.text,
                border: colors.border,
                notification: colors.accent,
            },
        };
    }, [dark, colors]);

    return (
        <NavigationContainer theme={navTheme} documentTitle={{ formatter: o => (o?.title ? `${o.title} · GroceryCompanion` : 'GroceryCompanion') }}>
            <Stack.Navigator screenOptions={{ headerTintColor: colors.primary, headerTitleStyle: { color: colors.text }, headerShadowVisible: false }}>
                <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
                <Stack.Screen name="ListDetail" component={ListDetailScreen} options={{ title: 'List' }} />
                <Stack.Screen name="RecipeDetail" component={RecipeDetailScreen} options={{ title: 'Recipe' }} />
                <Stack.Screen name="RecipeEdit" component={RecipeEditScreen} options={{ title: 'Recipe' }} />
                <Stack.Screen name="Settings" component={SettingsScreen} />
                <Stack.Screen name="Household" component={HouseholdScreen} />
                <Stack.Screen name="Pro" component={ProScreen} options={{ title: 'Pro', presentation: 'modal' }} />
            </Stack.Navigator>
        </NavigationContainer>
    );
}
