import React, { useState, useEffect } from 'react';
import {
    Modal,
    View,
    Text,
    TextInput,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, QUANTITY_UNITS } from '../../utils/constants';
import { Button } from '../common/Button';
import { ListItem, Category, CATEGORY_CONFIG } from '../../types';

interface EditItemModalProps {
    visible: boolean;
    onClose: () => void;
    onSave: (updates: Partial<ListItem>) => void;
    item: ListItem | null;
}

export function EditItemModal({ visible, onClose, onSave, item }: EditItemModalProps) {
    const [name, setName] = useState('');
    const [quantity, setQuantity] = useState('');
    const [unit, setUnit] = useState('');
    const [price, setPrice] = useState('');
    const [category, setCategory] = useState<Category>('other');
    const [notes, setNotes] = useState('');

    useEffect(() => {
        if (item) {
            setName(item.name);
            setQuantity(item.quantity ? item.quantity.toString() : '');
            setUnit(item.unit || '');
            setPrice(item.price ? item.price.toString() : '');
            setCategory(item.category);
            setNotes(item.notes || '');
        }
    }, [item]);

    const handleSave = () => {
        if (!item || !name.trim()) return;

        const parsedQuantity = quantity ? parseFloat(quantity) : undefined;
        const parsedPrice = price ? parseFloat(price) : undefined;

        const updates: Partial<ListItem> = {
            name: name.trim(),
            quantity: parsedQuantity && !isNaN(parsedQuantity) ? parsedQuantity : undefined,
            unit: unit || undefined,
            price: parsedPrice && !isNaN(parsedPrice) ? parsedPrice : undefined,
            category,
            notes: notes.trim() || undefined,
        };

        onSave(updates);
        onClose();
    };

    if (!item) return null;

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
                        <Text style={styles.modalTitle}>Edit Item</Text>
                        <TouchableOpacity onPress={onClose}>
                            <Text style={styles.closeButton}>✕</Text>
                        </TouchableOpacity>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false}>
                        <Text style={styles.label}>Name</Text>
                        <TextInput
                            style={styles.input}
                            value={name}
                            onChangeText={setName}
                            placeholder="Item name"
                            placeholderTextColor={COLORS.textLight}
                        />

                        <View style={styles.row}>
                            <View style={styles.col}>
                                <Text style={styles.label}>Quantity</Text>
                                <TextInput
                                    style={styles.input}
                                    value={quantity}
                                    onChangeText={setQuantity}
                                    placeholder="1"
                                    placeholderTextColor={COLORS.textLight}
                                    keyboardType="numeric"
                                />
                            </View>
                            <View style={styles.col}>
                                <Text style={styles.label}>Unit</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.unitScroller}>
                                    {QUANTITY_UNITS.map((u) => (
                                        <TouchableOpacity
                                            key={u.value}
                                            style={[
                                                styles.unitChip,
                                                unit === u.value && styles.unitChipSelected
                                            ]}
                                            onPress={() => setUnit(u.value)}
                                        >
                                            <Text style={[
                                                styles.unitText,
                                                unit === u.value && styles.unitTextSelected
                                            ]}>
                                                {u.label || '-'}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>
                        </View>

                        <Text style={styles.label}>Price</Text>
                        <TextInput
                            style={styles.input}
                            value={price}
                            onChangeText={setPrice}
                            placeholder="0.00"
                            placeholderTextColor={COLORS.textLight}
                            keyboardType="numeric"
                        />

                        <Text style={styles.label}>Category</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroller}>
                            {(Object.keys(CATEGORY_CONFIG) as Category[]).map((cat) => (
                                <TouchableOpacity
                                    key={cat}
                                    style={[
                                        styles.categoryChip,
                                        category === cat && { backgroundColor: CATEGORY_CONFIG[cat].color, borderColor: CATEGORY_CONFIG[cat].color },
                                        category !== cat && { borderColor: COLORS.divider, backgroundColor: 'transparent', borderWidth: 1 }
                                    ]}
                                    onPress={() => setCategory(cat)}
                                >
                                    <Text style={styles.categoryEmoji}>{CATEGORY_CONFIG[cat].icon}</Text>
                                    <Text style={[
                                        styles.categoryText,
                                        category === cat ? { color: COLORS.surface } : { color: COLORS.text }
                                    ]}>
                                        {cat}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        <Text style={styles.label}>Notes</Text>
                        <TextInput
                            style={[styles.input, styles.textArea]}
                            value={notes}
                            onChangeText={setNotes}
                            placeholder="Add notes..."
                            placeholderTextColor={COLORS.textLight}
                            multiline
                            numberOfLines={3}
                        />

                        <View style={styles.footer}>
                            <Button
                                title="Save Changes"
                                onPress={handleSave}
                                disabled={!name.trim()}
                                fullWidth
                            />
                        </View>
                    </ScrollView>
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
        maxHeight: '90%',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACING.lg,
    },
    modalTitle: {
        fontSize: FONT_SIZES.xl,
        fontWeight: 'bold',
        color: COLORS.text,
    },
    closeButton: {
        fontSize: FONT_SIZES.xl,
        color: COLORS.textSecondary,
        padding: SPACING.xs,
    },
    label: {
        fontSize: FONT_SIZES.sm,
        fontWeight: '600',
        color: COLORS.text,
        marginBottom: SPACING.xs,
        marginTop: SPACING.md,
    },
    input: {
        backgroundColor: COLORS.background,
        borderRadius: BORDER_RADIUS.lg,
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
        fontSize: FONT_SIZES.md,
        color: COLORS.text,
        borderWidth: 1,
        borderColor: COLORS.divider,
    },
    textArea: {
        height: 80,
        textAlignVertical: 'top',
    },
    row: {
        flexDirection: 'row',
        gap: SPACING.md,
    },
    col: {
        flex: 1,
    },
    unitScroller: {
        flexDirection: 'row',
        height: 40,
    },
    unitChip: {
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.xs,
        borderRadius: BORDER_RADIUS.full,
        borderWidth: 1,
        borderColor: COLORS.divider,
        marginRight: SPACING.xs,
        justifyContent: 'center',
    },
    unitChipSelected: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
    },
    unitText: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.text,
    },
    unitTextSelected: {
        color: COLORS.surface,
        fontWeight: '600',
    },
    categoryScroller: {
        flexDirection: 'row',
        marginBottom: SPACING.sm,
    },
    categoryChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.xs,
        borderRadius: BORDER_RADIUS.full,
        marginRight: SPACING.xs,
    },
    categoryEmoji: {
        fontSize: 16,
        marginRight: 4,
    },
    categoryText: {
        fontSize: FONT_SIZES.sm,
        fontWeight: '500',
        textTransform: 'capitalize',
    },
    footer: {
        marginTop: SPACING.xl,
        marginBottom: SPACING.xl, // Extra padding for bottom
    },
});
