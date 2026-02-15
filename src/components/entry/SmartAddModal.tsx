import React, { useState } from 'react';
import {
    Modal,
    View,
    Text,
    TextInput,
    StyleSheet,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
} from 'react-native';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../utils/constants';
import { Button } from '../common/Button';
import { Ionicons } from '@expo/vector-icons';
import { parseIngredient } from '../../utils/parsing';

interface SmartAddModalProps {
    visible: boolean;
    onClose: () => void;
    onAddItems: (items: string[]) => void;
}

export function SmartAddModal({ visible, onClose, onAddItems }: SmartAddModalProps) {
    const [text, setText] = useState('');

    const handleAdd = () => {
        if (!text.trim()) return;

        // Split by newlines and filter empty
        const items = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);

        onAddItems(items);
        setText('');
        onClose();
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent
            onRequestClose={onClose}
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={styles.modalOverlay}
            >
                <View style={styles.modalContent}>
                    <View style={styles.header}>
                        <View>
                            <Text style={styles.modalTitle}>Smart Add</Text>
                            <Text style={styles.modalSubtitle}>Paste a list of ingredients</Text>
                        </View>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close" size={24} color={COLORS.text} />
                        </TouchableOpacity>
                    </View>

                    <TextInput
                        style={styles.input}
                        value={text}
                        onChangeText={setText}
                        placeholder={"1 cup milk\n2 eggs\nBread\n..."}
                        placeholderTextColor={COLORS.textLight}
                        multiline
                        textAlignVertical="top"
                        autoFocus
                    />

                    <View style={styles.footer}>
                        <Button
                            title="Add Items"
                            onPress={handleAdd}
                            disabled={!text.trim()}
                            fullWidth
                        />
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: COLORS.surface,
        borderTopLeftRadius: BORDER_RADIUS.xl,
        borderTopRightRadius: BORDER_RADIUS.xl,
        padding: SPACING.lg,
        height: '70%', // Take up significant screen space
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: SPACING.lg,
    },
    modalTitle: {
        fontSize: FONT_SIZES.xl,
        fontWeight: 'bold',
        color: COLORS.text,
    },
    modalSubtitle: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.textSecondary,
        marginTop: 4,
    },
    input: {
        flex: 1,
        backgroundColor: COLORS.background,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.md,
        fontSize: FONT_SIZES.md,
        color: COLORS.text,
        borderWidth: 1,
        borderColor: COLORS.divider,
    },
    footer: {
        marginTop: SPACING.lg,
    },
});
