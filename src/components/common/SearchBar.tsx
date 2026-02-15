import React from 'react';
import { View, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES } from '../../utils/constants';

interface SearchBarProps {
    value: string;
    onChangeText: (text: string) => void;
    placeholder?: string;
    onClear?: () => void;
}

export function SearchBar({ value, onChangeText, placeholder = 'Search...', onClear }: SearchBarProps) {
    return (
        <View style={styles.container}>
            <Ionicons name="search" size={20} color={COLORS.textSecondary} style={styles.icon} />
            <TextInput
                style={styles.input}
                value={value}
                onChangeText={onChangeText}
                placeholder={placeholder}
                placeholderTextColor={COLORS.textLight}
                returnKeyType="search"
            />
            {value.length > 0 && (
                <TouchableOpacity onPress={onClear || (() => onChangeText(''))}>
                    <Ionicons name="close-circle" size={20} color={COLORS.textSecondary} />
                </TouchableOpacity>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.lg,
        paddingHorizontal: SPACING.md,
        height: 48,
        borderWidth: 1,
        borderColor: COLORS.divider,
    },
    icon: {
        marginRight: SPACING.sm,
    },
    input: {
        flex: 1,
        fontSize: FONT_SIZES.md,
        color: COLORS.text,
        height: '100%',
    },
});
