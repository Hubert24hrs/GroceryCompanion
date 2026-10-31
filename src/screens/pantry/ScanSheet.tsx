import { BarcodeScanningResult, CameraView, useCameraPermissions } from 'expo-camera';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import { isValidBarcode } from '../../services/barcode';
import { Button, Field, Text } from '../../ui/primitives';
import { Sheet } from '../../ui/Sheet';
import { radius, spacing, useTheme } from '../../ui/theme';

const BARCODE_TYPES = ['ean13', 'ean8', 'upc_a', 'upc_e'] as const;

/**
 * Reads one product barcode — with the camera on iOS/Android, or typed in on
 * web and as a fallback when camera access is denied.
 */
export function ScanSheet({ visible, onClose, onCode, busy }: {
    visible: boolean;
    onClose: () => void;
    onCode: (code: string) => void;
    busy: boolean;
}) {
    const { colors } = useTheme();
    const [permission, requestPermission] = useCameraPermissions();
    const [manual, setManual] = useState('');
    const [error, setError] = useState<string | null>(null);
    const handled = useRef(false);
    const hasCamera = Platform.OS !== 'web';

    useEffect(() => {
        if (!visible) return;
        handled.current = false;
        setManual('');
        setError(null);
        if (hasCamera && permission && !permission.granted && permission.canAskAgain) void requestPermission();
    }, [visible, hasCamera, permission, requestPermission]);

    const onScanned = (result: BarcodeScanningResult) => {
        if (handled.current || busy) return;
        handled.current = true;
        onCode(result.data);
    };

    const submitManual = () => {
        const code = manual.replace(/\s/g, '');
        if (!isValidBarcode(code)) {
            setError('Barcodes are 8 to 14 digits, printed under the stripes.');
            return;
        }
        onCode(code);
    };

    return (
        <Sheet visible={visible} onClose={onClose} title="Scan a product">
            {hasCamera ? (
                permission?.granted ? (
                    <View style={[styles.camera, { backgroundColor: '#000' }]}>
                        <CameraView
                            style={StyleSheet.absoluteFill}
                            facing="back"
                            barcodeScannerSettings={{ barcodeTypes: [...BARCODE_TYPES] }}
                            onBarcodeScanned={busy ? undefined : onScanned}
                        />
                        <View pointerEvents="none" style={[styles.frame, { borderColor: colors.accent }]} />
                        {busy ? (
                            <View style={[StyleSheet.absoluteFill, styles.busy]}>
                                <ActivityIndicator color="#fff" size="large" />
                                <Text color="#fff">Looking it up…</Text>
                            </View>
                        ) : null}
                    </View>
                ) : (
                    <View style={[styles.camera, styles.denied, { backgroundColor: colors.surfaceAlt }]}>
                        <Text muted style={{ textAlign: 'center' }}>
                            {permission && !permission.canAskAgain
                                ? 'Camera access is off for Grocery Companion. Turn it on in Settings, or type the barcode below.'
                                : 'Allow camera access to scan barcodes.'}
                        </Text>
                        {permission?.canAskAgain !== false ? <Button title="Allow camera" small onPress={() => void requestPermission()} /> : null}
                    </View>
                )
            ) : null}
            <Field
                label={hasCamera ? 'Or type the barcode' : 'Barcode number'}
                value={manual}
                onChangeText={t => {
                    setManual(t);
                    setError(null);
                }}
                placeholder="e.g. 5000159484695"
                keyboardType="number-pad"
                autoFocus={!hasCamera}
                error={error}
                onSubmitEditing={submitManual}
                returnKeyType="search"
            />
            <Button title="Look up" icon="search" onPress={submitManual} loading={busy} />
            <Text variant="caption" muted>
                Product names come from Open Food Facts. Anything it doesn’t know, you name once and we remember it.
            </Text>
        </Sheet>
    );
}

const styles = StyleSheet.create({
    camera: { height: 260, borderRadius: radius.md, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
    frame: { width: '75%', height: 110, borderWidth: 3, borderRadius: radius.md },
    busy: { alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: 'rgba(0,0,0,0.55)' },
    denied: { padding: spacing.lg, gap: spacing.md },
});
