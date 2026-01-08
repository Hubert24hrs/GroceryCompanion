import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    SafeAreaView,
    Alert,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../utils/constants';
import { Button } from '../components/common/Button';
import { useUserStore } from '../store/useUserStore';
import { supabase } from '../services/sync/supabase';

interface AuthScreenProps {
    navigation: any;
}

export function AuthScreen({ navigation }: AuthScreenProps) {
    const [isSignUp, setIsSignUp] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const { signInAnonymously } = useUserStore();

    const handleAuth = async () => {
        if (!email || !password) {
            Alert.alert('Error', 'Please enter both email and password');
            return;
        }

        setIsLoading(true);
        try {
            if (isSignUp) {
                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                });
                if (error) throw error;
                Alert.alert('Success', 'Check your email for the confirmation link!');
            } else {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (error) throw error;
                // Navigation will happen automatically via AppNavigator listening to auth state
            }
        } catch (error) {
            Alert.alert('Error', (error as Error).message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSkip = async () => {
        try {
            await signInAnonymously();
        } catch (error) {
            Alert.alert('Error', 'Failed to sign in anonymously');
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.content}
            >
                <View style={styles.header}>
                    <Text style={styles.logo}>🛒</Text>
                    <Text style={styles.title}>Grocery Companion</Text>
                    <Text style={styles.subtitle}>
                        {isSignUp ? 'Create an account to sync lists' : 'Sign in to access your lists'}
                    </Text>
                </View>

                <View style={styles.form}>
                    <TextInput
                        style={styles.input}
                        placeholder="Email"
                        placeholderTextColor={COLORS.textLight}
                        value={email}
                        onChangeText={setEmail}
                        autoCapitalize="none"
                        keyboardType="email-address"
                    />

                    <TextInput
                        style={styles.input}
                        placeholder="Password"
                        placeholderTextColor={COLORS.textLight}
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                    />

                    <Button
                        title={isSignUp ? 'Sign Up' : 'Sign In'}
                        onPress={handleAuth}
                        loading={isLoading}
                        style={styles.authButton}
                    />

                    <TouchableOpacity
                        style={styles.switchButton}
                        onPress={() => setIsSignUp(!isSignUp)}
                    >
                        <Text style={styles.switchText}>
                            {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
                        </Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.footer}>
                    <View style={styles.divider}>
                        <View style={styles.line} />
                        <Text style={styles.orText}>OR</Text>
                        <View style={styles.line} />
                    </View>

                    <Button
                        title="Continue as Guest"
                        variant="outline"
                        onPress={handleSkip}
                        style={styles.guestButton}
                    />
                    <Text style={styles.guestHint}>
                        Lists won't sync across devices until you sign in
                    </Text>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    content: {
        flex: 1,
        padding: SPACING.xl,
        justifyContent: 'center',
    },
    header: {
        alignItems: 'center',
        marginBottom: SPACING.xxl,
    },
    logo: {
        fontSize: 64,
        marginBottom: SPACING.md,
    },
    title: {
        fontSize: FONT_SIZES.xxxl,
        fontWeight: 'bold',
        color: COLORS.text,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: FONT_SIZES.md,
        color: COLORS.textSecondary,
        marginTop: SPACING.sm,
        textAlign: 'center',
    },
    form: {
        marginBottom: SPACING.xl,
    },
    input: {
        backgroundColor: COLORS.surface,
        height: 50,
        borderRadius: BORDER_RADIUS.lg,
        paddingHorizontal: SPACING.md,
        fontSize: FONT_SIZES.md,
        marginBottom: SPACING.md,
        borderWidth: 1,
        borderColor: COLORS.divider,
    },
    authButton: {
        marginTop: SPACING.sm,
    },
    switchButton: {
        marginTop: SPACING.lg,
        alignItems: 'center',
    },
    switchText: {
        color: COLORS.primary,
        fontSize: FONT_SIZES.md,
        fontWeight: '600',
    },
    footer: {
        marginTop: SPACING.lg,
    },
    divider: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: SPACING.lg,
    },
    line: {
        flex: 1,
        height: 1,
        backgroundColor: COLORS.divider,
    },
    orText: {
        marginHorizontal: SPACING.md,
        color: COLORS.textSecondary,
        fontSize: FONT_SIZES.sm,
    },
    guestButton: {
        marginBottom: SPACING.sm,
    },
    guestHint: {
        textAlign: 'center',
        color: COLORS.textSecondary,
        fontSize: FONT_SIZES.sm,
    },
});
