import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES } from '../../utils/constants';

interface WeekCalendarProps {
    selectedDate: string;
    onSelectDate: (date: string) => void;
}

export function WeekCalendar({ selectedDate, onSelectDate }: WeekCalendarProps) {
    const dates = useMemo(() => {
        const result = [];
        const today = new Date();
        // Start from today, show next 14 days
        for (let i = 0; i < 14; i++) {
            const date = new Date(today);
            date.setDate(today.getDate() + i);
            result.push(date);
        }
        return result;
    }, []);

    const formatDate = (date: Date) => date.toISOString().split('T')[0];
    const getDayName = (date: Date) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()];
    const getDayNumber = (date: Date) => date.getDate();

    return (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.container}
        >
            {dates.map((date) => {
                const dateStr = formatDate(date);
                const isSelected = selectedDate === dateStr;
                return (
                    <TouchableOpacity
                        key={dateStr}
                        style={[styles.dayCard, isSelected && styles.selectedCard]}
                        onPress={() => onSelectDate(dateStr)}
                    >
                        <Text style={[styles.dayName, isSelected && styles.selectedText]}>
                            {getDayName(date)}
                        </Text>
                        <Text style={[styles.dayNumber, isSelected && styles.selectedText]}>
                            {getDayNumber(date)}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.md,
        gap: SPACING.sm,
    },
    dayCard: {
        width: 50,
        height: 70,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: BORDER_RADIUS.lg,
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.divider,
    },
    selectedCard: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
        elevation: 4,
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
    },
    dayName: {
        fontSize: FONT_SIZES.xs,
        color: COLORS.textSecondary,
        marginBottom: 4,
        fontWeight: '600',
    },
    dayNumber: {
        fontSize: FONT_SIZES.lg,
        color: COLORS.text,
        fontWeight: 'bold',
    },
    selectedText: {
        color: COLORS.surface,
    },
});
