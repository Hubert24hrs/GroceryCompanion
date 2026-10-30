import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { getDb } from '../../data/db';
import { createList, updateList } from '../../data/repo';
import { canCreateList, FREE_LIMITS } from '../../domain/entitlements';
import { ShoppingList } from '../../domain/types';
import { cleanText, parseMoney, validateName } from '../../domain/validation';
import { useIsPro } from '../../state/session';
import { toast } from '../../state/toast';
import { Button, Field, Text } from '../../ui/primitives';
import { Sheet } from '../../ui/Sheet';
import { spacing } from '../../ui/theme';

export const LIST_COLORS = ['#2E7D4B', '#E2702A', '#2F7FB5', '#8A5BC2', '#C2453D', '#D9A520', '#3AA6C9', '#7D6B5D'];

/** Create or edit a list's name, colour, store and budget. */
export function ListFormSheet({ visible, onClose, list, onSaved }: {
    visible: boolean;
    onClose: () => void;
    list?: ShoppingList | null;
    onSaved?: (list: ShoppingList) => void;
}) {
    const [name, setName] = useState('');
    const [store, setStore] = useState('');
    const [budget, setBudget] = useState('');
    const [color, setColor] = useState(LIST_COLORS[0]);
    const [errors, setErrors] = useState<{ name?: string; budget?: string }>({});
    const isPro = useIsPro();

    useEffect(() => {
        if (!visible) return;
        setName(list?.name ?? '');
        setStore(list?.storeName ?? '');
        setBudget(list?.budget != null ? String(list.budget) : '');
        setColor(list?.color ?? LIST_COLORS[0]);
        setErrors({});
    }, [visible, list]);

    const save = () => {
        const n = validateName(name, 'List name', 60);
        const b = parseMoney(budget, 'Budget');
        if (!n.ok || !b.ok) {
            setErrors({ name: n.ok ? undefined : n.error, budget: b.ok ? undefined : b.error });
            return;
        }
        const storeName = cleanText(store, 80) || null;
        if (list) {
            updateList(list.id, { name: n.value, color, storeName, budget: b.value });
            onSaved?.({ ...list, name: n.value, color, storeName, budget: b.value });
        } else {
            // Re-check the free limit against live data: a screen hidden behind
            // another can open this sheet with a stale list count.
            const activeLists = getDb().list('lists').filter(l => !l.isArchived && !l.isTemplate).length;
            if (!canCreateList(isPro, activeLists)) {
                onClose();
                toast(`The free plan includes ${FREE_LIMITS.activeLists} active lists.`, { tone: 'warning' });
                return;
            }
            onSaved?.(createList({ name: n.value, color, storeName, budget: b.value }));
        }
        onClose();
    };

    return (
        <Sheet
            visible={visible}
            onClose={onClose}
            title={list ? 'Edit list' : 'New list'}
            footer={<Button title={list ? 'Save' : 'Create list'} onPress={save} />}
        >
            <Field
                label="Name"
                value={name}
                onChangeText={setName}
                placeholder="Weekly shop"
                autoFocus={!list}
                error={errors.name}
                returnKeyType="done"
                onSubmitEditing={save}
            />
            <View style={{ gap: 6 }}>
                <Text variant="label" muted>
                    Colour
                </Text>
                <View style={styles.swatches}>
                    {LIST_COLORS.map(c => (
                        <Pressable
                            key={c}
                            onPress={() => setColor(c)}
                            accessibilityRole="radio"
                            accessibilityState={{ checked: c === color }}
                            accessibilityLabel={`Colour ${c}`}
                            style={[styles.swatch, { backgroundColor: c }]}
                        >
                            {c === color ? <Ionicons name="checkmark" size={18} color="#fff" /> : null}
                        </Pressable>
                    ))}
                </View>
            </View>
            <Field label="Store (optional)" value={store} onChangeText={setStore} placeholder="e.g. Trader Joe's" />
            <Field
                label="Budget (optional)"
                value={budget}
                onChangeText={setBudget}
                placeholder="0.00"
                keyboardType="decimal-pad"
                error={errors.budget}
            />
        </Sheet>
    );
}

const styles = StyleSheet.create({
    swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    swatch: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
