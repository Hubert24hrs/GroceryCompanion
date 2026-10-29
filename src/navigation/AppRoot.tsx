import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { useSession } from '../state/session';
import { ToastHost } from '../ui/ToastHost';
import { useTheme } from '../ui/theme';
import { RootNavigator } from './navigation';

export function AppRoot() {
    const sessionReady = useSession(s => s.ready);
    const onboarded = useSession(s => s.onboarded);
    const { dark, colors } = useTheme();
    // Icon glyphs render as empty boxes on web until their fonts arrive.
    const [fontsLoaded, fontError] = useFonts({ ...Ionicons.font, ...MaterialCommunityIcons.font });
    const ready = sessionReady && (fontsLoaded || !!fontError);

    useEffect(() => {
        void useSession.getState().boot();
    }, []);

    return (
        <GestureHandlerRootView style={[styles.root, { backgroundColor: colors.background }]}>
            <SafeAreaProvider>
                <StatusBar style={dark ? 'light' : 'dark'} />
                {!ready ? (
                    <View style={styles.splash}>
                        <ActivityIndicator size="large" color={colors.primary} />
                    </View>
                ) : onboarded ? (
                    <RootNavigator />
                ) : (
                    <OnboardingScreen />
                )}
                <ToastHost />
            </SafeAreaProvider>
        </GestureHandlerRootView>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1 },
    splash: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
