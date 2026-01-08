import React, { useState, useCallback } from 'react';
import {
    View,
    TextInput,
    Text,
    StyleSheet,
    TouchableOpacity,
    FlatList,
    Keyboard,
} from 'react-native';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../utils/constants';
import { CATEGORY_CONFIG, Category, RecentItem } from '../../types';
import { useListStore } from '../../store/useListStore';
import { autoCategorize } from '../../services/categorization/autoCategorize';

interface QuickAddBarProps {
    onItemAdded?: () => void;
}

export function QuickAddBar({ onItemAdded }: QuickAddBarProps) {
    const [inputValue, setInputValue] = useState('');
    const [suggestions, setSuggestions] = useState<RecentItem[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);

    const { addItem, searchRecent, recentItems } = useListStore();

    const handleInputChange = useCallback(async (text: string) => {
        setInputValue(text);

        if (text.length > 0) {
            const results = await searchRecent(text);
            setSuggestions(results);
            setShowSuggestions(results.length > 0);
        } else {
            setSuggestions(recentItems.slice(0, 5));
            setShowSuggestions(recentItems.length > 0);
        }
    }, [searchRecent, recentItems]);

    const handleAddItem = useCallback(async (itemName?: string, category?: Category) => {
        const name = itemName || inputValue.trim();
        if (!name) return;

        await addItem(name, category);
        setInputValue('');
        setShowSuggestions(false);
        Keyboard.dismiss();
        onItemAdded?.();
    }, [inputValue, addItem, onItemAdded]);

    const handleSuggestionPress = useCallback((suggestion: RecentItem) => {
        handleAddItem(suggestion.name, suggestion.category);
    }, [handleAddItem]);

    const handleFocus = useCallback(() => {
        if (inputValue.length === 0 && recentItems.length > 0) {
            setSuggestions(recentItems.slice(0, 5));
            setShowSuggestions(true);
        }
    }, [inputValue, recentItems]);

    const previewCategory = inputValue.length > 0 ? autoCategorize(inputValue) : null;

    return (
        <View style={styles.container}>
            <View style={styles.inputContainer}>
                <TextInput
                    style={styles.input}
                    placeholder="Add item..."
                    placeholderTextColor={COLORS.textLight}
                    value={inputValue}
                    onChangeText={handleInputChange}
                    onFocus={handleFocus}
                    onSubmitEditing={() => handleAddItem()}
                    returnKeyType="done"
                    autoCorrect={false}
                />

                {previewCategory && (
                    <View style={[styles.categoryBadge, { backgroundColor: CATEGORY_CONFIG[previewCategory].color }]}>
                        <Text style={styles.categoryEmoji}>{CATEGORY_CONFIG[previewCategory].icon}</Text>
                    </View>
                )}

                <TouchableOpacity
                    style={[styles.addButton, !inputValue.trim() && styles.addButtonDisabled]}
                    onPress={() => handleAddItem()}
                    disabled={!inputValue.trim()}
                >
                    <Text style={styles.addButtonText}>+</Text>
                </TouchableOpacity>
            </View>

            {showSuggestions && suggestions.length > 0 && (
                <View style={styles.suggestionsContainer}>
                    <FlatList
                        data={suggestions}
                        keyExtractor={(item) => item.name}
                        keyboardShouldPersistTaps="handled"
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                style={styles.suggestionItem}
                                onPress={() => handleSuggestionPress(item)}
                            >
                                <Text style={styles.suggestionEmoji}>
                                    {CATEGORY_CONFIG[item.category].icon}
                                </Text>
                                <Text style={styles.suggestionText}>{item.name}</Text>
                                <Text style={styles.suggestionCount}>×{item.usageCount}</Text>
                            </TouchableOpacity>
                        )}
                    />
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
        backgroundColor: COLORS.surface,
        borderTopWidth: 1,
        borderTopColor: COLORS.divider,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.background,
        borderRadius: BORDER_RADIUS.lg,
        paddingHorizontal: SPACING.md,
    },
    input: {
        flex: 1,
        height: 48,
        fontSize: FONT_SIZES.md,
        color: COLORS.text,
    },
    categoryBadge: {
        width: 32,
        height: 32,
        borderRadius: BORDER_RADIUS.full,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: SPACING.sm,
    },
    categoryEmoji: {
        fontSize: 16,
    },
    addButton: {
        width: 40,
        height: 40,
        borderRadius: BORDER_RADIUS.full,
        backgroundColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    addButtonDisabled: {
        backgroundColor: COLORS.textLight,
    },
    addButtonText: {
        fontSize: 24,
        color: COLORS.surface,
        fontWeight: '600',
    },
    suggestionsContainer: {
        marginTop: SPACING.sm,
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.lg,
        maxHeight: 200,
        borderWidth: 1,
        borderColor: COLORS.divider,
    },
    suggestionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: SPACING.sm,
        paddingHorizontal: SPACING.md,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.divider,
    },
    suggestionEmoji: {
        fontSize: 18,
        marginRight: SPACING.sm,
    },
    suggestionText: {
        flex: 1,
        fontSize: FONT_SIZES.md,
        color: COLORS.text,
        textTransform: 'capitalize',
    },
    suggestionCount: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.textSecondary,
    },
});
