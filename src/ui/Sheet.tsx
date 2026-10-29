import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, IconButton, IconName, Text } from './primitives';
import { radius, spacing, useTheme } from './theme';

/** Bottom sheet built on Modal so it works the same on iOS, Android and web. */
export function Sheet({ visible, onClose, title, children, footer }: {
    visible: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    footer?: React.ReactNode;
}) {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.root}>
                <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: colors.backdrop }]} onPress={onClose} accessibilityLabel="Close" />
                <View style={[styles.sheet, { backgroundColor: colors.surface, paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
                    <View style={[styles.grabber, { backgroundColor: colors.border }]} />
                    <View style={styles.header}>
                        <Text variant="heading" style={{ flex: 1 }} accessibilityRole="header">
                            {title}
                        </Text>
                        <IconButton icon="close" label="Close" onPress={onClose} filled />
                    </View>
                    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
                        {children}
                    </ScrollView>
                    {footer ? <View style={styles.footer}>{footer}</View> : null}
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

export interface ActionItem {
    label: string;
    icon?: IconName;
    destructive?: boolean;
    onPress: () => void;
}

/** A sheet of tappable actions (long-press menus, overflow menus). */
export function ActionSheet({ visible, onClose, title, actions }: {
    visible: boolean;
    onClose: () => void;
    title: string;
    actions: ActionItem[];
}) {
    const { colors } = useTheme();
    return (
        <Sheet visible={visible} onClose={onClose} title={title}>
            {actions.map(a => (
                <Pressable
                    key={a.label}
                    accessibilityRole="button"
                    onPress={() => {
                        onClose();
                        // iOS can't present a new modal while this one is still dismissing.
                        setTimeout(a.onPress, Platform.OS === 'ios' ? 350 : 0);
                    }}
                    style={({ pressed }) => [styles.action, { backgroundColor: pressed ? colors.surfaceAlt : 'transparent' }]}
                >
                    {a.icon ? <Ionicons name={a.icon} size={20} color={a.destructive ? colors.danger : colors.textMuted} /> : null}
                    <Text color={a.destructive ? colors.danger : undefined}>{a.label}</Text>
                </Pressable>
            ))}
        </Sheet>
    );
}

/** Confirmation for destructive actions (Alert.alert is a no-op on web). */
export function ConfirmSheet({ visible, onClose, title, message, confirmLabel, onConfirm }: {
    visible: boolean;
    onClose: () => void;
    title: string;
    message: string;
    confirmLabel: string;
    onConfirm: () => void;
}) {
    return (
        <Sheet
            visible={visible}
            onClose={onClose}
            title={title}
            footer={
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                    <Button title="Cancel" variant="secondary" onPress={onClose} style={{ flex: 1 }} />
                    <Button
                        title={confirmLabel}
                        variant="danger"
                        onPress={() => {
                            onClose();
                            onConfirm();
                        }}
                        style={{ flex: 1 }}
                    />
                </View>
            }
        >
            <Text muted>{message}</Text>
        </Sheet>
    );
}

const styles = StyleSheet.create({
    root:{ flex: 1, justifyContent: 'flex-end' },
    sheet: {
        borderTopLeftRadius: radius.lg + 6,
        borderTopRightRadius: radius.lg + 6,
        maxHeight: '90%',
        width: '100%',
        maxWidth: 640,
        alignSelf: 'center',
    },
    grabber: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: spacing.sm },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
    body: { padding: spacing.lg, gap: spacing.lg },
    footer: { paddingHorizontal: spacing.lg, gap: spacing.sm },
    action: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderRadius: radius.md, paddingHorizontal: spacing.md, minHeight: 48 },
});
