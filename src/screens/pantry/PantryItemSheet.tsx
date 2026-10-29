import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { addPantryItem, deletePantryItem, restorePantryItem, updatePantryItem } from '../../data/repo';
import { autoCategorize, CATEGORIES, CATEGORY_LIST } from '../../domain/categories';
import { addDays, isValidISODate, today } from '../../domain/dates';
import { findPantryMatch } from '../../domain/pantry';
import { Category, PantryItem, PantryLocation } from '../../domain/types';
import { COMMON_UNITS, formatQuantity } from '../../domain/units';
import { cleanText, parseOptionalNumber, validateName } from '../../domain/validation';
import { getDb } from '../../data/db';
import { rememberBarcode } from '../../services/barcode';
import { toast } from '../../state/toast';
import { Button, Chip, Field, Text } from '../../ui/primitives';
import { Sheet } from '../../ui/Sheet';
import { spacing } from '../../ui/theme';
import { formatDateShort, LOCATIONS } from './pantryUi';

/** Prefill for a new item, e.g. from a barcode scan. */
export interface PantryDraft {
    name?: string;
    category?: Category;
    barcode?: string | null;
    /** The scanned barcode had no name; remember what the user types for next time. */
    unknownBarcode?: boolean;
}

const EXPIRY_PRESETS: { label: string; days: number }[] = [
    { label: '3 days', days: 3 },
    { label: '1 week', days: 7 },
    { label: '2 weeks', days: 14 },
    { label: '1 month', days: 30 },
    { label: '6 months', days: 182 },
];

type Errors = Partial<Record<'name' | 'quantity' | 'threshold' | 'expiry', string>>;

/** Add (draft) or edit (item) a pantry entry. Pass exactly one of them to open it. */
export function PantryItemSheet({ item, draft, onClose }: { item: PantryItem | null; draft: PantryDraft | null; onClose: () => void }) {
    const open = !!item || !!draft;
    const [name, setName] = useState('');
    const [quantity, setQuantity] = useState('');
    const [unit, setUnit] = useState<string | null>(null);
    const [location, setLocation] = useState<PantryLocation | null>(null);
    const [category, setCategory] = useState<Category | null>(null);
    const [expiry, setExpiry] = useState('');
    const [threshold, setThreshold] = useState('');
    const [notes, setNotes] = useState('');
    const [errors, setErrors] = useState<Errors>({});

    useEffect(() => {
        if (!open) return;
        setName(item?.name ?? draft?.name ?? '');
        setQuantity(item ? String(item.quantity) : '1');
        setUnit(item?.unit ?? null);
        setLocation(item?.location ?? null);
        setCategory(item?.category ?? draft?.category ?? null);
        setExpiry(item?.expiresOn ?? '');
        setThreshold(item?.lowStockThreshold != null ? String(item.lowStockThreshold) : '');
        setNotes(item?.notes ?? '');
        setErrors({});
    }, [open, item, draft]);

    if (!open) return null;

    // Until the user picks an aisle, follow what the name suggests.
    const effectiveCategory = category ?? (name.trim() ? autoCategorize(name) : 'other');

    const save = () => {
        const n = validateName(name, 'Name');
        const q = parseOptionalNumber(quantity, 'Quantity');
        const t = parseOptionalNumber(threshold, 'Low-stock level');
        const e = expiry.trim();
        const next: Errors = {
            name: n.ok ? undefined : n.error,
            quantity: !q.ok ? q.error : q.value == null ? 'Enter how many you have (0 is fine).' : undefined,
            threshold: t.ok ? undefined : t.error,
            expiry: e && !isValidISODate(e) ? 'Use the format YYYY-MM-DD.' : undefined,
        };
        if (Object.values(next).some(Boolean) || !n.ok || !q.ok || !t.ok) {
            setErrors(next);
            return;
        }
        const fields = {
            quantity: q.value ?? 0,
            unit,
            category: effectiveCategory,
            expiresOn: e || null,
            lowStockThreshold: t.value,
            notes: cleanText(notes) || null,
            ...(location ? { location } : null),
        };

        if (item) {
            updatePantryItem(item.id, { name: n.value, ...fields });
        } else {
            const existing = findPantryMatch(getDb().list('pantry_items'), n.value);
            const saved = addPantryItem({ name: n.value, barcode: draft?.barcode ?? null, ...fields });
            if (draft?.barcode && draft.unknownBarcode) rememberBarcode(draft.barcode, saved.name, saved.category);
            toast(
                existing && existing.id === saved.id
                    ? `${saved.name}: you now have ${formatQuantity(saved.quantity, saved.unit) || saved.quantity}.`
                    : `Added ${saved.name} to the pantry.`,
                { tone: 'success' },
            );
        }
        onClose();
    };

    const remove = () => {
        if (!item) return;
        deletePantryItem(item.id);
        onClose();
        toast(`Removed ${item.name}`, { actionLabel: 'Undo', onAction: () => restorePantryItem(item.id) });
    };

    return (
        <Sheet
            visible
            onClose={onClose}
            title={item ? 'Edit pantry item' : 'Add to pantry'}
            footer={
                <View style={styles.footer}>
                    {item ? <Button title="Delete" icon="trash-outline" variant="danger" onPress={remove} /> : null}
                    <Button title={item ? 'Save' : 'Add'} onPress={save} style={{ flex: 1 }} />
                </View>
            }
        >
            {draft?.barcode ? (
                <Text variant="caption" muted>
                    Barcode {draft.barcode}
                    {draft.unknownBarcode ? " — we couldn't find this product. Name it once and we'll remember it." : ''}
                </Text>
            ) : null}
            <Field label="Name" value={name} onChangeText={setName} placeholder="e.g. Greek yogurt" autoFocus={!item && !draft?.name} error={errors.name} />
            <View style={styles.row}>
                <View style={{ flex: 1 }}>
                    <Field label="Quantity" value={quantity} onChangeText={setQuantity} keyboardType="decimal-pad" error={errors.quantity} />
                </View>
                <View style={{ flex: 1 }}>
                    <Field
                        label="Low when at or below"
                        value={threshold}
                        onChangeText={setThreshold}
                        placeholder="Optional"
                        keyboardType="decimal-pad"
                        error={errors.threshold}
                    />
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
                    Stored in
                </Text>
                <View style={styles.chips}>
                    {LOCATIONS.map(l => (
                        <Chip
                            key={l.key}
                            label={l.label}
                            icon={l.icon}
                            selected={(location ?? item?.location) === l.key}
                            onPress={() => setLocation(l.key)}
                        />
                    ))}
                </View>
                {!location && !item ? (
                    <Text variant="caption" muted>
                        Leave unset and we’ll pick based on the aisle.
                    </Text>
                ) : null}
            </View>
            <View style={styles.group}>
                <Field
                    label="Best before"
                    value={expiry}
                    onChangeText={setExpiry}
                    placeholder="YYYY-MM-DD"
                    autoCapitalize="none"
                    error={errors.expiry}
                />
                <View style={styles.chips}>
                    <Chip label="No date" selected={!expiry} onPress={() => setExpiry('')} />
                    {EXPIRY_PRESETS.map(p => {
                        const value = addDays(today(), p.days);
                        return <Chip key={p.label} label={p.label} selected={expiry === value} onPress={() => setExpiry(value)} />;
                    })}
                </View>
                {expiry && isValidISODate(expiry) ? (
                    <Text variant="caption" muted>
                        {formatDateShort(expiry)}
                    </Text>
                ) : null}
            </View>
            <View style={styles.group}>
                <Text variant="label" muted>
                    Aisle
                </Text>
                <View style={styles.chips}>
                    {CATEGORY_LIST.map(c => (
                        <Chip
                            key={c}
                            label={CATEGORIES[c].label}
                            color={CATEGORIES[c].color}
                            selected={effectiveCategory === c}
                            onPress={() => setCategory(c)}
                        />
                    ))}
                </View>
            </View>
            <Field label="Notes" value={notes} onChangeText={setNotes} placeholder="Opened, brand, shelf…" multiline style={{ minHeight: 70, paddingTop: 12 }} />
        </Sheet>
    );
}

const styles = StyleSheet.create({
    footer: { flexDirection: 'row', gap: spacing.sm },
    row: { flexDirection: 'row', gap: spacing.md },
    group: { gap: spacing.sm },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
