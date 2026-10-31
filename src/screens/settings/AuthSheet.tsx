import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { validateEmail, validatePassword } from '../../domain/validation';
import { useSession } from '../../state/session';
import { toast } from '../../state/toast';
import { Banner, Button, Field, Text } from '../../ui/primitives';
import { Sheet } from '../../ui/Sheet';
import { spacing, useTheme } from '../../ui/theme';

export type AuthMode = 'signin' | 'signup' | 'reset';

const TITLES: Record<AuthMode, string> = { signin: 'Sign in', signup: 'Create account', reset: 'Reset password' };

/** Email + password auth. Lists and pantry on this device move into the account. */
export function AuthSheet({ mode: initialMode, onClose }: { mode: AuthMode | null; onClose: () => void }) {
    const { colors } = useTheme();
    const [mode, setMode] = useState<AuthMode>('signin');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
    const [notice, setNotice] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!initialMode) return;
        setMode(initialMode);
        setPassword('');
        setErrors({});
        setNotice(null);
    }, [initialMode]);

    if (!initialMode) return null;

    const switchTo = (m: AuthMode) => {
        setMode(m);
        setErrors({});
        setNotice(null);
    };

    const submit = async () => {
        const e = validateEmail(email);
        // Only new passwords must meet the strength rules; existing ones just can't be empty.
        const p = mode === 'signup' ? validatePassword(password) : password ? { ok: true as const, value: password } : { ok: false as const, error: 'Enter your password.' };
        const next = { email: e.ok ? undefined : e.error, password: mode === 'reset' || p.ok ? undefined : p.error };
        setErrors(next);
        if (!e.ok || (mode !== 'reset' && !p.ok)) return;

        setBusy(true);
        try {
            const session = useSession.getState();
            if (mode === 'signin') {
                await session.signIn(e.value, password);
                onClose();
                toast('Signed in. Your data is syncing.', { tone: 'success' });
            } else if (mode === 'signup') {
                const result = await session.signUp(e.value, password);
                if (result === 'confirm-email') {
                    setNotice(`We sent a confirmation link to ${e.value}. Open it, then sign in here.`);
                    setMode('signin');
                } else {
                    onClose();
                    toast('Account created. Your data is syncing.', { tone: 'success' });
                }
            } else {
                await session.resetPassword(e.value);
                setNotice(`If ${e.value} has an account, a reset link is on its way.`);
                setMode('signin');
            }
        } catch (err) {
            setErrors({ form: err instanceof Error ? err.message : 'Something went wrong. Try again.' });
        } finally {
            setBusy(false);
        }
    };

    return (
        <Sheet
            visible
            onClose={onClose}
            title={TITLES[mode]}
            footer={<Button title={mode === 'reset' ? 'Send reset link' : TITLES[mode]} loading={busy} onPress={submit} />}
        >
            {notice ? <Banner tone="info" icon="mail-outline" message={notice} /> : null}
            {errors.form ? <Banner tone="danger" message={errors.form} /> : null}
            {mode === 'signup' ? (
                <Text variant="caption" muted>
                    Lists, pantry, recipes and plans already on this device move into your new account.
                </Text>
            ) : null}
            <Field
                label="Email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                textContentType="emailAddress"
                error={errors.email}
            />
            {mode !== 'reset' ? (
                <Field
                    label="Password"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                    textContentType={mode === 'signup' ? 'newPassword' : 'password'}
                    error={errors.password}
                    onSubmitEditing={submit}
                    returnKeyType="go"
                />
            ) : null}
            {mode === 'signup' ? (
                <Text variant="caption" muted>
                    At least 8 characters, with a letter and a number.
                </Text>
            ) : null}
            <View style={{ gap: spacing.md, alignItems: 'center' }}>
                {mode === 'signin' ? (
                    <>
                        <Link label="Forgot your password?" color={colors.primary} onPress={() => switchTo('reset')} />
                        <Link label="New here? Create an account" color={colors.primary} onPress={() => switchTo('signup')} />
                    </>
                ) : (
                    <Link label="Already have an account? Sign in" color={colors.primary} onPress={() => switchTo('signin')} />
                )}
            </View>
        </Sheet>
    );
}

function Link({ label, color, onPress }: { label: string; color: string; onPress: () => void }) {
    return (
        <Pressable onPress={onPress} hitSlop={8} accessibilityRole="button">
            <Text variant="label" color={color}>
                {label}
            </Text>
        </Pressable>
    );
}
