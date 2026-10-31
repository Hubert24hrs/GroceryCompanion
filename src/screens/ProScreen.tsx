import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RootScreenProps } from '../navigation/navigation';
import { ANNUAL_SAVING, FREE_FEATURES, PRO_FEATURES, PRO_PRICES } from '../domain/entitlements';
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
import { isBackendConfigured } from '../services/firebase';
import { useIsPro, useSession } from '../state/session';
import { toast, toastError } from '../state/toast';
import { Banner, Button, Card, IconName, Text } from '../ui/primitives';
import { layout } from '../ui/Screen';
import { radius, spacing, useTheme } from '../ui/theme';

type Period = 'monthly' | 'annual';

interface PlanCard {
    period: Period;
    /** Store package id when the store is available. */
    id: string | null;
    price: string;
}

/**
 * Store prices when RevenueCat is configured (localised per country), else
 * the list prices so people can see what Pro costs before it's on sale.
 */
function planCards(storePlans: PlanOption[] | null): PlanCard[] {
    const fromStore = (period: Period) => storePlans?.find(p => p.period === period);
    return (['monthly', 'annual'] as Period[]).map(period => {
        const store = fromStore(period);
        return { period, id: store?.id ?? null, price: store?.priceString ?? PRO_PRICES[period].label };
    });
}

export function ProScreen({ navigation }: RootScreenProps<'Pro'>) {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const isPro = useIsPro();
    const accountPro = useSession(s => s.accountPro);
    const [storePlans, setStorePlans] = useState<PlanOption[] | null>(null);
    const [plansError, setPlansError] = useState<string | null>(null);
    const [loading, setLoading] = useState(purchasesAvailable);
    const [chosen, setChosen] = useState<Period>('annual');
    const [busy, setBusy] = useState<'buy' | 'restore' | null>(null);

    useEffect(() => {
        if (!purchasesAvailable || isPro) {
            setLoading(false);
            return;
        }
        getPlans()
            .then(setStorePlans)
            .catch(e => setPlansError(e instanceof Error ? e.message : 'Plans could not be loaded.'))
            .finally(() => setLoading(false));
    }, [isPro]);

    const cards = planCards(storePlans);
    const selected = cards.find(c => c.period === chosen)!;
    const canBuy = purchasesAvailable && !!selected.id;

    const done = (pro: boolean) => {
        useSession.getState().setStorePro(pro);
        if (pro) {
            toast('Welcome to Pro! Everything is unlocked.', { tone: 'success' });
            navigation.goBack();
        }
    };

    const buy = async () => {
        if (!selected.id) return;
        // A purchase made signed out never reaches the account, so the server can't unlock Pro.
        if (isBackendConfigured && !useSession.getState().user) {
            toast('Sign in first so Pro stays with your account.', { tone: 'info', actionLabel: 'Settings', onAction: () => navigation.navigate('Settings') });
            return;
        }
        setBusy('buy');
        try {
            done(await purchasePlan(selected.id));
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
                        {isPro ? 'Everything below is unlocked on your account.' : 'Every feature, for your whole kitchen. Cancel any time.'}
                    </Text>
                </View>

                {!isPro ? (
                    <View style={{ gap: spacing.md }}>
                        {cards.map(c => {
                            const on = c.period === chosen;
                            return (
                                <Pressable
                                    key={c.period}
                                    onPress={() => setChosen(c.period)}
                                    accessibilityRole="radio"
                                    accessibilityState={{ checked: on }}
                                    accessibilityLabel={`${c.period === 'annual' ? 'Yearly' : 'Monthly'}, ${c.price}`}
                                    style={[styles.plan, { backgroundColor: colors.surface, borderColor: on ? colors.primary : colors.border, borderWidth: on ? 2 : 1 }]}
                                >
                                    <Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={22} color={on ? colors.primary : colors.textMuted} />
                                    <View style={{ flex: 1, gap: 2 }}>
                                        <Text variant="subheading">{c.period === 'annual' ? 'Yearly' : 'Monthly'}</Text>
                                        {c.period === 'annual' ? (
                                            <View style={[styles.saveTag, { backgroundColor: colors.primarySoft }]}>
                                                <Text variant="caption" color={colors.primary} style={{ fontWeight: '700' }}>
                                                    Save {ANNUAL_SAVING}%
                                                </Text>
                                            </View>
                                        ) : (
                                            <Text variant="caption" muted>
                                                Billed every month
                                            </Text>
                                        )}
                                    </View>
                                    <View style={{ alignItems: 'flex-end' }}>
                                        <Text variant="heading">{c.price}</Text>
                                        <Text variant="caption" muted>
                                            {c.period === 'annual' ? 'per year' : 'per month'}
                                        </Text>
                                    </View>
                                </Pressable>
                            );
                        })}

                        {loading ? <ActivityIndicator color={colors.primary} /> : null}
                        {plansError ? <Banner tone="danger" message={plansError} /> : null}
                        {!purchasesAvailable ? (
                            <Banner tone="info" icon="time-outline" message={purchasesUnavailableReason ?? 'Subscriptions are not available here.'} />
                        ) : null}
                        <Button
                            title={canBuy ? `Subscribe for ${selected.price}${chosen === 'annual' ? ' / year' : ' / month'}` : 'Subscriptions open soon'}
                            icon="sparkles"
                            variant="accent"
                            loading={busy === 'buy'}
                            disabled={!canBuy || !!busy}
                            onPress={buy}
                        />
                        <Text variant="caption" muted style={{ textAlign: 'center' }}>
                            Renews automatically until cancelled in your app store account. Prices shown in your store’s local currency at checkout.
                        </Text>
                    </View>
                ) : null}

                <Card style={{ gap: spacing.lg }}>
                    <Text variant="subheading">{isPro ? 'Your Pro features' : 'Everything in Pro'}</Text>
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

                {!isPro ? (
                    <Card style={{ gap: spacing.sm }}>
                        <Text variant="subheading">The free plan includes</Text>
                        {FREE_FEATURES.map(f => (
                            <View key={f} style={styles.freeRow}>
                                <Ionicons name="checkmark" size={16} color={colors.textMuted} />
                                <Text variant="caption" muted style={{ flex: 1 }}>
                                    {f}
                                </Text>
                            </View>
                        ))}
                    </Card>
                ) : null}

                {isPro && !(accountPro && !purchasesAvailable) ? (
                    <Button title="Manage subscription" icon="open-outline" variant="secondary" onPress={() => void Linking.openURL(manageSubscriptionsUrl()).catch(toastError)} />
                ) : null}
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
    plan: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderRadius: radius.md },
    saveTag: { alignSelf: 'flex-start', paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.pill },
    feature: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    featureIcon: { width: 34, height: 34, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
    freeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
