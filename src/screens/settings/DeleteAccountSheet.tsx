import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSession } from '../../state/session';
import { toast } from '../../state/toast';
import { Banner, Button, Field, Text } from '../../ui/primitives';
import { Sheet } from '../../ui/Sheet';
import { spacing, useTheme } from '../../ui/theme';

/**
 * Permanent account deletion (Google Play and App Store requirement).
 * Signed out, it wipes this device's data instead.
 */
export function DeleteAccountSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
    const { colors } = useTheme();
    const user = useSession(s => s.user);
    const role = useSession(s => s.role);
    const householdName = useSession(s => s.householdName);
    const members = useSession(s => s.members);
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (visible) {
            setPassword('');
            setError(null);
        }
    }, [visible]);

    const others = members.filter(m => m.userId !== user?.id).length;

    const confirm = async () => {
        setBusy(true);
        setError(null);
        try {
            if (user) {
                if (!password) {
                    setError('Enter your password to confirm.');
                    return;
                }
                await useSession.getState().deleteAccount(password);
                onClose();
                toast('Your account and its data have been deleted.', { tone: 'success', durationMs: 5000 });
            } else {
                await useSession.getState().deleteLocalData();
                onClose();
                toast('Everything on this device has been deleted.', { tone: 'success' });
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
        } finally {
            setBusy(false);
        }
    };

    const points = user
        ? [
              role === 'owner'
                  ? `Your household “${householdName}” with all its lists, pantry, recipes, meal plans and spending history${others ? ` — the ${others} other member${others === 1 ? '' : 's'} will lose access to it` : ''}`
                  : `You’ll be removed from “${householdName}”; its owner keeps the shared lists`,
              'Your preferences and sign-in account',
              'Everything stored on this device',
          ]
        : ['All lists, pantry items, recipes, meal plans and spending history on this device', 'Your preferences'];

    return (
        <Sheet
            visible={visible}
            onClose={onClose}
            title={user ? 'Delete account' : 'Delete data on this device'}
            footer={
                <View style={styles.footer}>
                    <Button title="Cancel" variant="secondary" onPress={onClose} style={{ flex: 1 }} />
                    <Button title={user ? 'Delete account' : 'Delete data'} variant="danger" icon="trash-outline" loading={busy} onPress={confirm} style={{ flex: 1 }} />
                </View>
            }
        >
            <Text>This permanently deletes:</Text>
            <View style={{ gap: spacing.sm }}>
                {points.map(p => (
                    <View key={p} style={styles.point}>
                        <Ionicons name="close-circle" size={18} color={colors.danger} />
                        <Text variant="caption" style={{ flex: 1 }}>
                            {p}
                        </Text>
                    </View>
                ))}
            </View>
            <Text variant="caption" muted>
                This can’t be undone.
                {user ? ' Deleting your account doesn’t cancel a Pro subscription. Cancel it in your Google Play or App Store account to stop being charged.' : ''}
            </Text>
            {user ? (
                <Field
                    label={`Password for ${user.email ?? 'your account'}`}
                    value={password}
                    onChangeText={t => {
                        setPassword(t);
                        setError(null);
                    }}
                    secureTextEntry
                    autoComplete="current-password"
                    textContentType="password"
                    onSubmitEditing={confirm}
                    returnKeyType="done"
                />
            ) : null}
            {error ? <Banner tone="danger" message={error} /> : null}
        </Sheet>
    );
}

const styles = StyleSheet.create({
    footer: { flexDirection: 'row', gap: spacing.sm },
    point: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
});
