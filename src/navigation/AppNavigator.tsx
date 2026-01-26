import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HomeScreen } from '../screens/HomeScreen';
import { ListDetailScreen } from '../screens/ListDetailScreen';
import { NearbyStoresScreen } from '../screens/NearbyStoresScreen';
import { AuthScreen } from '../screens/AuthScreen';
import { COLORS } from '../utils/constants';
import { useUserStore } from '../store/useUserStore';
import { useSync } from '../hooks/useSync';
import { ShareListScreen } from '../screens/ShareListScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { PaywallScreen } from '../screens/PaywallScreen';
import { initDatabase } from '../services/database/sqlite';

export type RootStackParamList = {
    Auth: undefined;
    Home: undefined;
    ListDetail: { listId: string };
    Settings: undefined;
    NearbyStores: { listId: string };
    ShareList: { listId: string };
    Paywall: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function AppNavigator() {
    const { session, initialize, isLoading } = useUserStore();
    const [isDbReady, setIsDbReady] = useState(false);

    useSync();

    useEffect(() => {
        async function init() {
            try {
                await Promise.all([
                    initialize(),
                    initDatabase()
                ]);
            } catch (e) {
                console.error('Failed to initialize app:', e);
            } finally {
                setIsDbReady(true);
            }
        }
        init();
    }, []);

    if (isLoading || !isDbReady) {
        return null; // Or a splash screen
    }

    return (
        <NavigationContainer>
            <Stack.Navigator
                screenOptions={{
                    headerStyle: {
                        backgroundColor: COLORS.primary,
                    },
                    headerTintColor: COLORS.surface,
                    headerTitleStyle: {
                        fontWeight: '600',
                    },
                    animation: 'slide_from_right',
                }}
            >
                {!session ? (
                    <Stack.Screen
                        name="Auth"
                        component={AuthScreen}
                        options={{ headerShown: false }}
                    />
                ) : (
                    <>
                        <Stack.Screen
                            name="Home"
                            component={HomeScreen}
                            options={{
                                headerShown: false,
                            }}
                        />
                        <Stack.Screen
                            name="ListDetail"
                            component={ListDetailScreen}
                            options={{
                                title: 'Shopping List',
                            }}
                        />
                        <Stack.Screen
                            name="NearbyStores"
                            component={NearbyStoresScreen}
                            options={{
                                title: 'Nearby Stores',
                            }}
                        />
                        <Stack.Screen
                            name="ShareList"
                            component={ShareListScreen}
                            options={{
                                title: 'Share List',
                            }}
                        />
                        <Stack.Screen
                            name="Settings"
                            component={SettingsScreen}
                            options={{
                                title: 'Settings',
                            }}
                        />
                        <Stack.Screen
                            name="Paywall"
                            component={PaywallScreen}
                            options={{
                                headerTitle: '',
                                presentation: 'modal',
                                headerShown: false,
                            }}
                        />
                    </>
                )}
            </Stack.Navigator>
        </NavigationContainer>
    );
}
