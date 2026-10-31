import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { addParsedItems, deleteItem, suggestItems } from '../../data/repo';
import { itemKey } from '../../domain/pantry';
import { parseItems } from '../../domain/parsing';
import { formatQuantity } from '../../domain/units';
import { startListening, voiceSupported } from '../../services/voice';
import { useTable } from '../../state/hooks';
import { useIsPro } from '../../state/session';
import { toast, toastError } from '../../state/toast';
import { Chip, IconButton, tap } from '../../ui/primitives';
import { radius, spacing, useTheme } from '../../ui/theme';

/**
 * Free-text entry: "2 lb chicken, milk, 6 eggs" adds three categorised items.
 * Shows recent items as you type and reports merges/pantry duplicates with undo.
 */
export function QuickAddBar({ listId }: { listId: string }) {
    const { colors } = useTheme();
    const isPro = useIsPro();
    const [text, setText] = useState('');
    const [focused, setFocused] = useState(false);
    const [listening, setListening] = useState(false);
    const stopVoice = useRef<(() => void) | null>(null);
    const input = useRef<TextInput>(null);

    useEffect(() => () => stopVoice.current?.(), []);

    const items = useTable('items');
    const suggestions = useMemo(() => {
        if (!focused) return [];
        const last = text.split(',').pop()?.trim() ?? '';
        // Recent-item ids are itemKey(name); skip what's already waiting on this list.
        const waiting = new Set(items.filter(i => i.listId === listId && !i.isChecked).map(i => itemKey(i.name)));
        return suggestItems(last, 20)
            .filter(s => !waiting.has(s.id) && s.id !== itemKey(last))
            .slice(0, 8);
    }, [text, focused, items, listId]);

    const submit = async (value = text) => {
        const parsed = parseItems(value);
        if (parsed.length === 0) return;
        setText('');
        tap();
        try {
            const results = await addParsedItems(listId, parsed);
            if (results.length === 1) {
                const [{ item, merged, warning }] = results;
                if (merged) {
                    toast(`${item.name} was already on the list, now ${formatQuantity(item.quantity, item.unit) || 'more'}.`, { tone: 'info' });
                } else if (warning?.kind === 'in-pantry') {
                    toast(`You have ${formatQuantity(warning.item.quantity, warning.item.unit)} ${warning.item.name} in the pantry.`, {
                        tone: 'warning',
                        actionLabel: 'Undo',
                        onAction: () => deleteItem(item.id),
                    });
                }
            } else {
                const merged = results.filter(r => r.merged).length;
                const stocked = results.filter(r => r.warning?.kind === 'in-pantry').length;
                const notes = [merged && `${merged} merged`, stocked && `${stocked} already in the pantry`].filter(Boolean).join(', ');
                toast(`Added ${results.length} items${notes ? ` (${notes})` : ''}.`, { tone: 'success' });
            }
        } catch (e) {
            toastError(e);
        }
        input.current?.focus();
    };

    const pickSuggestion = (name: string) => {
        const parts = text.split(',');
        parts.pop();
        const prefix = parts.map(p => p.trim()).filter(Boolean);
        if (prefix.length) setText(`${[...prefix, name].join(', ')}, `);
        else void submit(name);
    };

    const toggleVoice = () => {
        if (listening) {
            stopVoice.current?.();
            stopVoice.current = null;
            setListening(false);
            return;
        }
        setListening(true);
        stopVoice.current = startListening(
            (heard, final) => {
                setText(heard);
                if (final) {
                    setListening(false);
                    stopVoice.current = null;
                    void submit(heard);
                }
            },
            message => {
                setListening(false);
                stopVoice.current = null;
                toast(message, { tone: 'error' });
            },
        );
    };

    return (
        <View style={styles.wrap}>
            <View style={[styles.bar, { backgroundColor: colors.surface, borderColor: focused ? colors.primary : colors.border }]}>
                <IconButton icon="add" label="Add item" onPress={() => void submit()} color={colors.primary} />
                <TextInput
                    ref={input}
                    value={text}
                    onChangeText={setText}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setTimeout(() => setFocused(false), 150)}
                    onSubmitEditing={() => void submit()}
                    placeholder={listening ? 'Listening…' : 'Add items, like 2 lb chicken, milk'}
                    placeholderTextColor={colors.textMuted}
                    returnKeyType="done"
                    blurOnSubmit={false}
                    autoCorrect={false}
                    accessibilityLabel="Add items"
                    style={[styles.input, { color: colors.text }]}
                />
                {voiceSupported && isPro ? (
                    <IconButton
                        icon={listening ? 'stop-circle' : 'mic-outline'}
                        label={listening ? 'Stop listening' : 'Add by voice'}
                        onPress={toggleVoice}
                        color={listening ? colors.accent : colors.textMuted}
                    />
                ) : null}
            </View>
            {suggestions.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="always" contentContainerStyle={styles.suggestions}>
                    {suggestions.map(s => (
                        <Chip key={s.id} label={s.name} icon="time-outline" onPress={() => pickSuggestion(s.name)} />
                    ))}
                </ScrollView>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { gap: spacing.sm },
    bar: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.md, borderWidth: 1.5, paddingHorizontal: spacing.xs, minHeight: 50 },
    // The bar draws its own focus ring, so drop the browser's outline on web.
    // react-native-web accepts outlineStyle 'none'; RN's types only list the native values.
    input: { flex: 1, fontSize: 16, paddingVertical: spacing.sm, ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null) },
    suggestions: { gap: spacing.sm, paddingRight: spacing.lg },
});
