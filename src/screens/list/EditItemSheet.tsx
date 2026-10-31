import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { deleteItem, restoreItem, updateItem } from '../../data/repo';
import { CATEGORIES, CATEGORY_LIST } from '../../domain/categories';
import { Category, ListItem } from '../../domain/types';
import { COMMON_UNITS } from '../../domain/units';
import { cleanText, parseMoney, parseOptionalNumber, validateName } from '../../domain/validation';
import { toast } from '../../state/toast';
import { Button, Chip, Field, Text } from '../../ui/primitives';
import { Sheet } from '../../ui/Sheet';
import { spacing } from '../../ui/theme';

type Errors = Partial<Record<'name' | 'quantity' | 'price', string>>;

export function EditItemSheet({ item, onClose }: { item: ListItem | null; onClose: () => void }) {
    const [name, setName] = useState('');
    const [quantity, setQuantity] = useState('');
    const [unit, setUnit] = useState<string | null>(null);
    const [category, setCategory] = useState<Category>('other');
    const [price, setPrice] = useState('');
    const [notes, setNotes] = useState('');
    const [errors, setErrors] = useState<Errors>({});

    useEffect(() => {
        if (!item) return;
        setName(item.name);
        setQuantity(item.quantity != null ? String(item.quantity) : '');
        setUnit(item.unit);
        setCategory(item.category);
        setPrice(item.price != null ? String(item.price) : '');
        setNotes(item.notes ?? '');
        setErrors({});
    }, [item]);

    if (!item) return null;

    const save = () => {
        const n = validateName(name, 'Name');
        const q = parseOptionalNumber(quantity, 'Quantity');
        const p = parseMoney(price);
        if (!n.ok || !q.ok || !p.ok) {
            setErrors({ name: n.ok ? undefined : n.error, quantity: q.ok ? undefined : q.error, price: p.ok ? undefined : p.error });
            return;
        }
        updateItem(item.id, {
            name: n.value,
            quantity: q.value,
            unit,
            price: p.value,
            notes: cleanText(notes) || null,
            ...(category !== item.category ? { category } : null),
        });
        onClose();
    };

    const remove = () => {
        deleteItem(item.id);
        onClose();
        toast(`Removed ${item.name}`, { actionLabel: 'Undo', onAction: () => restoreItem(item.id) });
    };

    return (
        <Sheet
            visible
            onClose={onClose}
            title="Edit item"
            footer={
                <View style={styles.footer}>
                    <Button title="Delete" icon="trash-outline" variant="danger" onPress={remove} />
                    <Button title="Save" onPress={save} style={{ flex: 1 }} />
                </View>
            }
        >
            <Field label="Name" value={name} onChangeText={setName} error={errors.name} />
            <View style={styles.row}>
                <View style={{ flex: 1 }}>
                    <Field
                        label="Quantity"
                        value={quantity}
                        onChangeText={setQuantity}
                        placeholder="1"
                        keyboardType="decimal-pad"
                        error={errors.quantity}
                    />
                </View>
                <View style={{ flex: 1 }}>
                    <Field label="Price" value={price} onChangeText={setPrice} placeholder="0.00" keyboardType="decimal-pad" error={errors.price} />
                </View>
            </View>
            <View style={styles.group}>
                <Text variant="label" muted>
                    Unit
                </Text>
                <View style={styles.chips}>
                    <Chip label="None" selected={!unit} onPress={() => setUnit(null)} />
                    {COMMON_UNITS.map(u => (
                        <Chip key={u} label={u} selected={unit === u} onPress={() => setUnit(u)} />
                    ))}
                </View>
            </View>
            <View style={styles.group}>
                <Text variant="label" muted>
                    Aisle
                </Text>
                <View style={styles.chips}>
                    {CATEGORY_LIST.map(c => (
                        <Chip key={c} label={CATEGORIES[c].label} color={CATEGORIES[c].color} selected={category === c} onPress={() => setCategory(c)} />
                    ))}
                </View>
            </View>
            <Field label="Notes" value={notes} onChangeText={setNotes} placeholder="Brand, size, ripeness…" multiline style={{ minHeight: 70, paddingTop: 12 }} />
        </Sheet>
    );
}

const styles = StyleSheet.create({
    footer: { flexDirection: 'row', gap: spacing.sm },
    row: { flexDirection: 'row', gap: spacing.md },
    group: { gap: spacing.sm },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
