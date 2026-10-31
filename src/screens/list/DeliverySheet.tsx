import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, View } from 'react-native';
import { DeliveryItem, DeliveryProvider, isValidPostalCode } from '../../domain/delivery';
import { DELIVERY_MODE } from '../../domain/entitlements';
import { usePrefs } from '../../state/prefs';
import { toastError } from '../../state/toast';
import { Banner, Field, Text } from '../../ui/primitives';
import { Sheet } from '../../ui/Sheet';
import { radius, spacing } from '../../ui/theme';

// Instacart's dark call-to-action colours. Its button also carries the Instacart
// logo, which comes from Instacart once the integration is approved.
const CTA_BACKGROUND = '#003D29';
const CTA_TEXT = '#FAF1E5';

/** Confirms what leaves the app, then opens the partner's page for this list. */
export function DeliverySheet({ visible, onClose, provider, country, items }: {
    visible: boolean;
    onClose: () => void;
    provider: DeliveryProvider;
    country: string;
    items: DeliveryItem[];
}) {
    const savedPostalCode = usePrefs(s => s.prefs.postalCode);
    const update = usePrefs(s => s.update);
    const [postalCode, setPostalCode] = useState(savedPostalCode ?? '');
    const [error, setError] = useState<string | null>(null);
    const [sending, setSending] = useState(false);
    const isUS = country === 'US';

    useEffect(() => {
        if (visible) {
            setPostalCode(savedPostalCode ?? '');
            setError(null);
        }
    }, [visible, savedPostalCode]);

    const send = async () => {
        if (!isValidPostalCode(country, postalCode)) {
            setError(isUS ? 'Enter a valid ZIP code, like 94105.' : 'Enter a valid postal code, like K1A 0B1.');
            return;
        }
        setSending(true);
        try {
            const code = postalCode.trim();
            const url = await provider.buildShoppingLink({ country, postalCode: code, items });
            await update({ postalCode: code });
            onClose();
            await Linking.openURL(url);
        } catch (e) {
            toastError(e);
        } finally {
            setSending(false);
        }
    };

    return (
        <Sheet
            visible={visible}
            onClose={onClose}
            title={provider.label}
            footer={
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={provider.label}
                    disabled={sending || !items.length}
                    onPress={() => void send()}
                    style={({ pressed }) => [styles.cta, { opacity: pressed || !items.length ? 0.7 : 1 }]}
                >
                    {sending ? <ActivityIndicator color={CTA_TEXT} /> : <Text style={{ color: CTA_TEXT, fontWeight: '600' }}>{provider.label}</Text>}
                </Pressable>
            }
        >
            <View style={{ gap: spacing.md }}>
                {DELIVERY_MODE === 'mock' ? <Banner tone="warning" message="Mock mode: nothing is sent to Instacart." /> : null}
                <Field
                    label={isUS ? 'ZIP code' : 'Postal code'}
                    value={postalCode}
                    onChangeText={v => {
                        setPostalCode(v);
                        setError(null);
                    }}
                    placeholder={isUS ? '94105' : 'K1A 0B1'}
                    keyboardType={isUS ? 'number-pad' : 'default'}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    returnKeyType="done"
                    onSubmitEditing={() => void send()}
                    error={error}
                />
                <Text variant="caption" muted>
                    {items.length === 1 ? 'The 1 item still on this list' : `The ${items.length} items still on this list`} and your{' '}
                    {isUS ? 'ZIP code' : 'postal code'} will be sent to Instacart to build your shopping list. Prices and availability are set there.
                </Text>
                <Text variant="caption" muted>
                    We may earn a commission when you order through Instacart.
                </Text>
            </View>
        </Sheet>
    );
}

const styles = StyleSheet.create({
    cta: {
        height: 46,
        paddingHorizontal: 18,
        borderRadius: radius.pill,
        backgroundColor: CTA_BACKGROUND,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
