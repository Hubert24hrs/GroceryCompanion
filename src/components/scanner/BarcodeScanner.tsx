import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Dimensions, Button, Alert } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { COLORS, BORDER_RADIUS, SPACING } from '../../utils/constants';
import { Ionicons } from '@expo/vector-icons';

interface Props {
    onScan: (data: string) => void;
    onClose: () => void;
}

export function BarcodeScanner({ onScan, onClose }: Props) {
    const [permission, requestPermission] = useCameraPermissions();
    const [scanned, setScanned] = useState(false);

    const handleBarCodeScanned = ({ type, data }: { type: string; data: string }) => {
        if (scanned) return;
        setScanned(true);
        onScan(data);
    };

    // Request camera permission on component mount
    useEffect(() => {
        (async () => {
            if (!permission?.granted) {
                await requestPermission();
            }
        })();
    }, []);

    if (!permission) {
        // Camera permissions are still loading
        return <View style={styles.container} />;
    }

    if (!permission.granted) {
        return (
            <View style={styles.container}>
                <Text style={styles.text}>We need your permission to show the camera</Text>
                <Button onPress={requestPermission} title="grant permission" />
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                    <Ionicons name="close" size={24} color="#FFF" />
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <CameraView
                style={StyleSheet.absoluteFillObject}
                onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                barcodeScannerSettings={{
                    barcodeTypes: ['ean13', 'ean8', 'upc_e', 'upc_a', 'qr'],
                }}
            />

            <View style={styles.overlay}>
                <View style={styles.scanArea} />
                <Text style={styles.instructionText}>Position barcode in the frame</Text>
            </View>

            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color="#FFF" />
            </TouchableOpacity>
        </View>
    );
}

const { width } = Dimensions.get('window');
const SCAN_SIZE = width * 0.7;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
        justifyContent: 'center',
        alignItems: 'center',
    },
    text: {
        color: '#FFF',
        fontSize: 16,
        marginBottom: 20,
    },
    overlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scanArea: {
        width: SCAN_SIZE,
        height: SCAN_SIZE,
        borderWidth: 2,
        borderColor: COLORS.primary,
        backgroundColor: 'transparent',
        borderRadius: BORDER_RADIUS.lg,
    },
    instructionText: {
        color: '#FFF',
        marginTop: SPACING.xl,
        fontSize: 16,
        fontWeight: '600',
        backgroundColor: 'rgba(0,0,0,0.6)',
        padding: SPACING.md,
        borderRadius: BORDER_RADIUS.md,
        overflow: 'hidden',
    },
    closeButton: {
        position: 'absolute',
        top: 50,
        right: 20,
        padding: 10,
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderRadius: 20,
    },
    closeText: {
        color: '#FFF',
        fontWeight: 'bold',
    },
});
