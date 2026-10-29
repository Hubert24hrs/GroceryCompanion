import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import appConfig from '../../app.json';
import { RootScreenProps } from '../navigation/navigation';
import { relativeTime } from '../domain/dates';
import { UserPreferences } from '../domain/types';
import { parseMoney } from '../domain/validation';
import { isSupabaseConfigured } from '../services/supabase';
import { DIETARY_OPTIONS, formatMoney, usePrefs } from '../state/prefs';
import { useIsPro, useSession } from '../state/session';
import { syncController, useSyncState } from '../state/sync';
import { toast, toastError } from '../state/toast';
import { Banner, Button, Card, Chip, Field, IconButton, IconName, Text } from '../ui/primitives';
import { layout } from '../ui/Screen';
import { ConfirmSheet } from '../ui/Sheet';
import { radius, spacing, useTheme } from '../ui/theme';
import { AuthMode, AuthSheet } from './settings/AuthSheet';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'NGN', 'INR', 'ZAR'];
const THEMES: { key: UserPreferences['theme']; label: string; icon: IconName }[] = [
    { key: 'system', label: 'Automatic', icon: 'phone-portrait-outline' },
    { key: 'light', label: 'Light', icon: 'sunny-outline' },
    { key: 'dark', label: 'Dark', icon: 'moon-outline' },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <View style={{ gap: spacing.sm }}>
            <Text variant="label" muted style={styles.sectionTitle}>
                {title.toUpperCase()}
            </Text>
            {children}
        </View>
    );
}

function Row({ icon, label, detail, onPress, right, tint }: {
    icon: IconName;
    label: string;
    detail?: string | null;
    onPress?: () => void;
    right?: React.ReactNode;
    tint?: string;
}) {
    const { colors } = useTheme();
    const body = (
        <>
            <View style={[styles.rowIcon, { backgroundColor: (tint ?? colors.primary) + '1F' }]}>
                <Ionicons name={icon} size={18} color={tint ?? colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
                <Text>{label}</Text>
                {detail ? (
                    <Text variant="caption" muted>
                        {detail}
                    </Text>
                ) : null}
            </View>
            {right ?? (onPress ? <Ionicons name="chevron-forward" size={18} color={colors.textMuted} /> : null)}
        </>
    );
    if (!onPress) return <View style={styles.row}>{body}</View>;
    return (
        <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}>
            {body}
        </Pressable>
    );
}

function SyncDetails() {
    const { colors } = useTheme();
    const sync = useSyncState();
    const [retrying, setRetrying] = useState(false);
    const engine = syncController.engine;
    const status =
        sync.status === 'syncing'
            ? 'Syncing…'
            : sync.status === 'offline'
              ? 'Offline — changes are saved here and will upload later'
              : sync.status === 'error'
                ? `Sync stopped: ${sync.lastError ?? 'unknown error'}`
                : sync.lastSyncedAt
                  ? `Up to date · ${relativeTime(sync.lastSyncedAt)}`
                  : 'Waiting to sync';
    return (
        <>
            <Row
                icon={sync.status === 'error' || sync.failed.length ? 'warning-outline' : 'cloud-done-outline'}
                tint={sync.status === 'error' || sync.failed.length ? colors.warning : undefined}
                label="Sync"
                detail={`${status}${sync.pending ? ` · ${sync.pending} change${sync.pending === 1 ? '' : 's'} waiting` : ''}`}
                right={
                    <IconButton
                        icon="refresh"
                        label="Sync now"
                        onPress={() => void engine?.syncNow()}
                        disabled={sync.status === 'syncing' || !engine}
                        color={colors.primary}
                    />
                }
            />
            {sync.failed.length ? (
                <View style={{ gap: spacing.sm }}>
                    <Banner
                        tone="warning"
                        message={`${sync.failed.length} change${sync.failed.length === 1 ? '' : 's'} couldn't be uploaded after several tries${sync.failed[0].lastError ? ` (${sync.failed[0].lastError})` : ''}.`}
                    />
                    <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                        <Button
                            title="Try again"
                            small
                            loading={retrying}
                            style={{ flex: 1 }}
                            onPress={async () => {
                                setRetrying(true);
                                await engine?.retryFailed().catch(toastError);
                                setRetrying(false);
                            }}
                        />
                        <Button
                            title="Use server copy"
                            small
                            variant="secondary"
                            style={{ flex: 1 }}
                            onPress={async () => {
                                for (const f of sync.failed) await engine?.discardFailed(f);
                                void engine?.syncNow();
                                toast('Discarded the stuck changes. Pulling the latest from your household.', { tone: 'info' });
                            }}
                        />
                    </View>
                </View>
            ) : null}
        </>
    );
}

export function SettingsScreen({ navigation }: RootScreenProps<'Settings'>) {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const prefs = usePrefs(s => s.prefs);
    const update = usePrefs(s => s.update);
    const user = useSession(s => s.user);
    const linking = useSession(s => s.linking);
    const householdName = useSession(s => s.householdName);
    const members = useSession(s => s.members);
    const role = useSession(s => s.role);
    const isPro = useIsPro();
    const [auth, setAuth] = useState<AuthMode | null>(null);
    const [confirmSignOut, setConfirmSignOut] = useState(false);
    const [budget, setBudget] = useState(prefs.monthlyBudget != null ? String(prefs.monthlyBudget) : '');
    const [budgetError, setBudgetError] = useState<string | null>(null);

    useEffect(() => setBudget(prefs.monthlyBudget != null ? String(prefs.monthlyBudget) : ''), [prefs.monthlyBudget]);

    const save = (patch: Partial<UserPreferences>) => void update(patch).catch(toastError);

    const saveBudget = () => {
        const b = parseMoney(budget, 'Budget');
        if (!b.ok) {
            setBudgetError(b.error);
            return;
        }
        setBudgetError(null);
        if (b.value !== prefs.monthlyBudget) {
            save({ monthlyBudget: b.value });
            toast(b.value ? `Monthly budget set to ${formatMoney(b.value)}.` : 'Monthly budget removed.', { tone: 'success' });
        }
    };

    const toggleDiet = (d: string) =>
        save({ dietary: prefs.dietary.includes(d) ? prefs.dietary.filter(x => x !== d) : [...prefs.dietary, d] });

    return (
        <View style={[styles.root, { backgroundColor: colors.background }]}>
            <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]} keyboardShouldPersistTaps="handled">
                <Section title="Account">
                    <Card style={styles.card}>
                        {!isSupabaseConfigured ? (
                            <Row
                                icon="phone-portrait-outline"
                                label="Saved on this device"
                                detail="Accounts and sharing aren't set up in this build, so everything stays on this device."
                            />
                        ) : !user ? (
                            <View style={{ gap: spacing.md, padding: spacing.md }}>
                                <Text variant="subheading">Sync and share</Text>
                                <Text variant="caption" muted>
                                    Sign in to keep your lists on all your devices and shop together with your household. Everything you’ve added
                                    so far comes with you.
                                </Text>
                                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                                    <Button title="Sign in" onPress={() => setAuth('signin')} style={{ flex: 1 }} />
                                    <Button title="Create account" variant="secondary" onPress={() => setAuth('signup')} style={{ flex: 1 }} />
                                </View>
                            </View>
                        ) : (
                            <>
                                <Row icon="person-circle-outline" label={user.email ?? 'Signed in'} detail={linking ? 'Connecting your household…' : 'Signed in'} />
                                <SyncDetails />
                                <Row icon="log-out-outline" label="Sign out" tint={colors.danger} onPress={() => setConfirmSignOut(true)} />
                            </>
                        )}
                    </Card>
                </Section>

                <Section title="Household">
                    <Card style={styles.card}>
                        <Row
                            icon="people-outline"
                            label={user ? householdName : 'Household sharing'}
                            detail={
                                user
                                    ? `${members.length || 1} member${members.length === 1 ? '' : 's'} · you're ${role === 'owner' ? 'the owner' : `an ${role}`}`
                                    : 'Invite family or housemates to the same lists'
                            }
                            onPress={() => navigation.navigate('Household')}
                        />
                    </Card>
                </Section>

                <Section title="Plan">
                    <Card style={styles.card}>
                        <Row
                            icon="sparkles-outline"
                            tint={colors.accent}
                            label={isPro ? 'GroceryCompanion Pro' : 'Free plan'}
                            detail={isPro ? 'Thanks for supporting the app!' : 'Unlimited lists and recipes, smart meal ideas, full spending history'}
                            onPress={() => navigation.navigate('Pro')}
                        />
                    </Card>
                </Section>

                <Section title="Preferences">
                    <Card style={[styles.card, { gap: spacing.lg, padding: spacing.lg }]}>
                        <View style={styles.inline}>
                            <View style={{ flex: 1 }}>
                                <Text>People you cook for</Text>
                                <Text variant="caption" muted>
                                    Sets default servings when you plan meals.
                                </Text>
                            </View>
                            <View style={[styles.stepper, { backgroundColor: colors.surfaceAlt }]}>
                                <IconButton
                                    icon="remove"
                                    size={18}
                                    label="Fewer people"
                                    disabled={prefs.householdSize <= 1}
                                    onPress={() => save({ householdSize: Math.max(1, prefs.householdSize - 1) })}
                                />
                                <Text variant="label" style={{ minWidth: 20, textAlign: 'center' }}>
                                    {prefs.householdSize}
                                </Text>
                                <IconButton icon="add" size={18} label="More people" onPress={() => save({ householdSize: Math.min(20, prefs.householdSize + 1) })} />
                            </View>
                        </View>
                        <View style={{ gap: spacing.sm }}>
                            <Text>Diet</Text>
                            <Text variant="caption" muted>
                                Meal ideas skip recipes that don’t fit.
                            </Text>
                            <View style={styles.chips}>
                                {DIETARY_OPTIONS.map(d => (
                                    <Chip key={d} label={d[0].toUpperCase() + d.slice(1)} selected={prefs.dietary.includes(d)} onPress={() => toggleDiet(d)} />
                                ))}
                            </View>
                        </View>
                        <View style={{ gap: spacing.sm }}>
                            <Field
                                label="Monthly grocery budget"
                                value={budget}
                                onChangeText={setBudget}
                                onBlur={saveBudget}
                                onSubmitEditing={saveBudget}
                                placeholder="No budget"
                                keyboardType="decimal-pad"
                                returnKeyType="done"
                                error={budgetError}
                            />
                            <View style={styles.chips}>
                                {CURRENCIES.map(c => (
                                    <Chip key={c} label={c} selected={prefs.currency === c} onPress={() => save({ currency: c })} />
                                ))}
                            </View>
                        </View>
                    </Card>
                </Section>

                <Section title="App">
                    <Card style={[styles.card, { gap: spacing.lg, padding: spacing.lg }]}>
                        <View style={{ gap: spacing.sm }}>
                            <Text>Appearance</Text>
                            <View style={styles.chips}>
                                {THEMES.map(t => (
                                    <Chip key={t.key} label={t.label} icon={t.icon} selected={prefs.theme === t.key} onPress={() => save({ theme: t.key })} />
                                ))}
                            </View>
                        </View>
                        {Platform.OS !== 'web' ? (
                            <View style={styles.inline}>
                                <Text style={{ flex: 1 }}>Vibrate on taps</Text>
                                <Switch
                                    value={prefs.haptics}
                                    onValueChange={v => save({ haptics: v })}
                                    trackColor={{ true: colors.primary, false: colors.border }}
                                    accessibilityLabel="Vibrate on taps"
                                />
                            </View>
                        ) : null}
                    </Card>
                </Section>

                <Text variant="caption" muted style={{ textAlign: 'center' }}>
                    GroceryCompanion {appConfig.expo.version}
                </Text>
            </ScrollView>

            <AuthSheet mode={auth} onClose={() => setAuth(null)} />
            <ConfirmSheet
                visible={confirmSignOut}
                onClose={() => setConfirmSignOut(false)}
                title="Sign out?"
                message="Your household's data stays in your account. This device goes back to an empty, offline copy until you sign in again."
                confirmLabel="Sign out"
                onConfirm={() =>
                    useSession
                        .getState()
                        .signOut()
                        .then(() => toast('Signed out.', { tone: 'info' }), toastError)
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1 },
    content: { padding: spacing.lg, gap: spacing.xl, ...layout.page },
    sectionTitle: { fontSize: 12, letterSpacing: 0.6, marginLeft: spacing.xs },
    card: { padding: spacing.xs },
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, minHeight: 56 },
    rowIcon: { width: 34, height: 34, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
    inline: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    stepper: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.pill },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
