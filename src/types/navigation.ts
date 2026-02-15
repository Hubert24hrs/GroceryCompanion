import { NavigatorScreenParams } from '@react-navigation/native';

export type MainTabParamList = {
    Home: undefined;
    Lists: undefined;
    Recipes: undefined;
    Planner: undefined; // Replaces Analytics
    Profile: undefined;
};

export type AuthStackParamList = {
    Welcome: undefined;
    Login: undefined;
    Register: undefined;
    ForgotPassword: undefined;
};

export type RootStackParamList = {
    Auth: NavigatorScreenParams<AuthStackParamList>;
    Main: NavigatorScreenParams<MainTabParamList>;
    ListDetail: { listId: string; name?: string };
    RecipeDetail: { recipeId: string; title?: string };
    NearbyStores: { listId?: string };
    ShareList: { listId: string };
    Settings: undefined;
    Paywall: { source?: string };
};
