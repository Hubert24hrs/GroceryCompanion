import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RootScreenProps } from '../navigation/navigation';
import { PRO_FEATURES } from '../domain/entitlements';
import {
    getPlans,
    manageSubscriptionsUrl,
    PlanOption,
    purchasePlan,
    PurchaseError,
    purchasesAvailable,
    purchasesUnavailableReason,
    restorePurchases,
} from '../services/purchases';
import { useIsPro, useSession } from '../state/session';
import { toast, toastError } from '../state/toast';
import { Banner, Button, Card, IconName, Text } from '../ui/primitives';
import { layout } from '../ui/Screen';
import { radius, spacing, useTheme } from '../ui/theme';

export function ProScreen({ navigation }: RootScreenProps<'Pro'>) {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const isPro = useIsPro();
    const accountPro = useSession(s => s.accountPro);
    const [plans, setPlans] = useState<PlanOption[] | null>(null);
    const [plansError, setPlansError] = useState<string | null>(null);
    const [chosen, setChosen] = useState<string | null>(null);
    const [busy, setBusy] = useState<'buy' | 'restore' | null>(null);

    useEffect(() => {
        if (!purchasesAvailable || isPro) return;
        getPlans()
            .then(p => {
                setPlans(p);
                setChosen(p.find(x => x.period === 'annual')?.id ?? p[0]?.id ?? null);
            })
            .catch(e => setPlansError(e instanceof Error ? e.message : 'Plans could not be loaded.'));
    }, [isPro]);

    const done = (pro: boolean) => {
        useSession.getState().setStorePro(pro);
        if (pro) {
            toast('Welcome to Pro! Everything is unlocked.', { tone: 'success' });
            navigation.goBack();
        }
    };

    const buy = async () => {
        if (!chosen) return;
        setBusy('buy');
        try {
            done(await purchasePlan(chosen));
        } catch (e) {
            if (!(e instanceof PurchaseError && e.cancelled)) toastError(e);
        } finally {
            setBusy(null);
        }
    };

    const restore = async () => {
        setBusy('restore');
        try {
            const pro = await restorePurchases();
            done(pro);
            if (!pro) toast('No active subscription found for this store account.', { tone: 'info' });
        } catch (e) {
            toastError(e);
        } finally {
            setBusy(null);
        }
    };

    return (
        <View style={[styles.root, { backgroundColor: colors.background }]}>
            <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}>
                <View style={styles.hero}>
                    <View style={[styles.badge, { backgroundColor: colors.accent }]}>
                        <Ionicons name="sparkles" size={30} color={colors.onAccent} />
                    </View>
                    <Text variant="title" style={{ textAlign: 'center' }}>
                        {isPro ? 'You’re on Pro' : 'GroceryCompanion Pro'}
                    </Text>
                    <Text muted style={{ textAlign: 'center' }}>
                        {isPro ? 'Everything below is unlocked on your account.' : 'More room, smarter ideas and the full picture of your spending.'}
                    </Text>
                </View>

                <Card style={{ gap: spacing.lg }}>
                    {PRO_FEATURES.map(f => (
                        <View key={f.feature} style={styles.feature}>
                            <View style={[styles.featureIcon, { backgroundColor: colors.accentSoft }]}>
                                <Ionicons name={f.icon as IconName} size={18} color={colors.accent} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text variant="label">{f.title}</Text>
                                <Text variant="caption" muted>
                                    {f.detail}
                                </Text>
                            </View>
                            {isPro ? <Ionicons name="checkmark-circle" size={20} color={colors.primary} /> : null}
                        </View>
                    ))}
                </Card>

                {isPro ? (
                    accountPro && !purchasesAvailable ? null : (
                        <Button title="Manage subscription" icon="open-outline" variant="secondary" onPress={() => void Linking.openURL(manageSubscriptionsUrl()).catch(toastError)} />
                    )
                ) : !purchasesAvailable ? (
                    <Banner tone="info" icon="phone-portrait-outline" message={purchasesUnavailableReason ?? 'Subscriptions are not available here.'} />
                ) : plansError ? (
                    <Banner tone="danger" message={plansError} />
                ) : !plans ? (
                    <ActivityIndicator color={colors.primary} />
                ) : plans.length === 0 ? (
                    <Banner tone="warning" message="No plans are available right now. Please try again later." />
                ) : (
                    <View style={{ gap: spacing.md }}>
                        {plans.map(p => {
                            const selected = p.id === chosen;
                            return (
                                <Pressable
                                    key={p.id}
                                    onPress={() => setChosen(p.id)}
                                    accessibilityRole="radio"
                                    accessibilityState={{ checked: selected }}
                                    style={[
                                        styles.plan,
                                        { backgroundColor: colors.surface, borderColor: selected ? colors.primary : colors.border, borderWidth: selected ? 2 : 1 },
                                    ]}
                                >
                                    <Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={22} color={selected ? colors.primary : colors.textMuted} />
                                    <View style={{ flex: 1 }}>
                                        <Text variant="label">{p.period === 'annual' ? 'Yearly' : p.period === 'monthly' ? 'Monthly' : p.title}</Text>
                                        {p.period === 'annual' ? (
                                            <Text variant="caption" color={colors.primary}>
                                                Best value
                                            </Text>
                                        ) : null}
                                    </View>
                                    <Text variant="subheading">
                                        {p.priceString}
                                        <Text variant="caption" muted>
                                            {p.period === 'annual' ? ' / year' : p.period === 'monthly' ? ' / month' : ''}
                                        </Text>
                                    </Text>
                                </Pressable>
                            );
                        })}
                        <Button title="Subscribe" icon="sparkles" variant="accent" loading={busy === 'buy'} disabled={!chosen || !!busy} onPress={buy} />
                        <Text variant="caption" muted style={{ textAlign: 'center' }}>
                            Renews automatically. Cancel any time in your store account settings.
                        </Text>
                    </View>
                )}

                {purchasesAvailable && !isPro ? <Button title="Restore purchases" variant="ghost" loading={busy === 'restore'} disabled={!!busy} onPress={restore} /> : null}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1 },
    content: { padding: spacing.lg, gap: spacing.xl, ...layout.page },
    hero: { alignItems: 'center', gap: spacing.sm, paddingTop: spacing.md },
    badge: { width: 64, height: 64, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
    feature: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    featureIcon: { width: 34, height: 34, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
    plan: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderRadius: radius.md },
});
