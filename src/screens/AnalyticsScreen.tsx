import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../utils/constants';
import { useListStore } from '../store/useListStore';
import { Ionicons } from '@expo/vector-icons';
import { PieChart, BarChart } from 'react-native-chart-kit';
import { Category, CATEGORY_CONFIG, ListItem } from '../types';
import * as db from '../services/database/sqlite';

const screenWidth = Dimensions.get('window').width;

export function AnalyticsScreen() {
    const { lists } = useListStore();
    const [expenses, setExpenses] = useState<ListItem[]>([]);
    const [timeRange, setTimeRange] = useState<'month' | 'year' | 'all'>('month');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        loadData();
    }, [timeRange]);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const now = new Date();
            let startDate: Date | undefined;

            if (timeRange === 'month') {
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            } else if (timeRange === 'year') {
                startDate = new Date(now.getFullYear(), 0, 1);
            }

            const data = await db.getExpenses(startDate);
            setExpenses(data);
        } catch (error) {
            console.error('Failed to load expenses', error);
        } finally {
            setIsLoading(false);
        }
    };

    // Calculations
    const totalSpent = useMemo(() => {
        return expenses.reduce((sum, item) => sum + (item.price || 0), 0);
    }, [expenses]);

    const spendingByCategory = useMemo(() => {
        const categoryMap: Record<string, number> = {};
        expenses.forEach(item => {
            const cat = item.category;
            categoryMap[cat] = (categoryMap[cat] || 0) + (item.price || 0);
        });

        return Object.entries(categoryMap)
            .map(([cat, amount]) => ({
                name: cat,
                population: amount,
                color: CATEGORY_CONFIG[cat as Category].color,
                legendFontColor: COLORS.text,
                legendFontSize: 12,
            }))
            .sort((a, b) => b.population - a.population);
    }, [expenses]);

    const activeListBudget = useMemo(() => {
        // Simple example: sum budgets of active lists
        return lists.filter(l => !l.isArchived).reduce((sum, l) => sum + (l.budget || 0), 0);
    }, [lists]);

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Spending Analytics</Text>
            </View>

            <View style={styles.rangeSelector}>
                <TouchableOpacity
                    style={[styles.rangeButton, timeRange === 'month' && styles.rangeButtonActive]}
                    onPress={() => setTimeRange('month')}
                >
                    <Text style={[styles.rangeText, timeRange === 'month' && styles.rangeTextActive]}>This Month</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.rangeButton, timeRange === 'year' && styles.rangeButtonActive]}
                    onPress={() => setTimeRange('year')}
                >
                    <Text style={[styles.rangeText, timeRange === 'year' && styles.rangeTextActive]}>This Year</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.rangeButton, timeRange === 'all' && styles.rangeButtonActive]}
                    onPress={() => setTimeRange('all')}
                >
                    <Text style={[styles.rangeText, timeRange === 'all' && styles.rangeTextActive]}>All Time</Text>
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {/* Total Spent Card */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Total Spent</Text>
                    <Text style={styles.totalAmount}>${totalSpent.toFixed(2)}</Text>

                    {activeListBudget > 0 && (
                        <View style={styles.budgetContainer}>
                            <Text style={styles.budgetText}>
                                Budget: ${activeListBudget.toFixed(2)}
                            </Text>
                            <View style={styles.progressBarBg}>
                                <View
                                    style={[
                                        styles.progressBarFill,
                                        { width: `${Math.min((totalSpent / activeListBudget) * 100, 100)}%` },
                                        totalSpent > activeListBudget && { backgroundColor: COLORS.destructive }
                                    ]}
                                />
                            </View>
                            <Text style={styles.budgetStatus}>
                                {totalSpent > activeListBudget
                                    ? `Over budget by $${(totalSpent - activeListBudget).toFixed(2)}`
                                    : `$${(activeListBudget - totalSpent).toFixed(2)} remaining`}
                            </Text>
                        </View>
                    )}
                </View>

                {/* Category Chart */}
                {spendingByCategory.length > 0 ? (
                    <View style={styles.chartCard}>
                        <Text style={styles.cardTitle}>Spending by Category</Text>
                        <PieChart
                            data={spendingByCategory}
                            width={screenWidth - SPACING.xl * 2}
                            height={220}
                            chartConfig={{
                                color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                            }}
                            accessor="population"
                            backgroundColor="transparent"
                            paddingLeft="15"
                            absolute
                        />
                    </View>
                ) : (
                    <View style={styles.emptyCard}>
                        <Text style={styles.emptyText}>No spending data for this period</Text>
                    </View>
                )}

                {/* Recent Expenses List - Optional */}
                {expenses.length > 0 && (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Recent Expenses</Text>
                        {expenses.slice(0, 5).map(item => (
                            <View key={item.id} style={styles.expenseRow}>
                                <View style={styles.expenseInfo}>
                                    <Text style={styles.expenseName}>{item.name}</Text>
                                    <Text style={styles.expenseDate}>{item.updatedAt.toLocaleDateString()}</Text>
                                </View>
                                <Text style={styles.expensePrice}>${item.price?.toFixed(2)}</Text>
                            </View>
                        ))}
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    header: {
        padding: SPACING.lg,
        backgroundColor: COLORS.surface,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.divider,
    },
    headerTitle: {
        fontSize: FONT_SIZES.xxl,
        fontWeight: 'bold',
        color: COLORS.primary,
    },
    rangeSelector: {
        flexDirection: 'row',
        padding: SPACING.md,
        gap: SPACING.sm,
    },
    rangeButton: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: BORDER_RADIUS.full,
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.divider,
    },
    rangeButtonActive: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
    },
    rangeText: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.text,
    },
    rangeTextActive: {
        color: COLORS.surface,
        fontWeight: '600',
    },
    content: {
        padding: SPACING.lg,
        gap: SPACING.lg,
    },
    card: {
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.lg,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    chartCard: {
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.lg,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
        alignItems: 'center',
    },
    cardTitle: {
        fontSize: FONT_SIZES.lg,
        fontWeight: '600',
        color: COLORS.text,
        marginBottom: SPACING.md,
    },
    totalAmount: {
        fontSize: 36,
        fontWeight: 'bold',
        color: COLORS.primary,
    },
    budgetContainer: {
        marginTop: SPACING.md,
    },
    budgetText: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.textSecondary,
        marginBottom: 4,
    },
    progressBarBg: {
        height: 8,
        backgroundColor: COLORS.background,
        borderRadius: 4,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: COLORS.primary,
    },
    budgetStatus: {
        fontSize: FONT_SIZES.xs,
        color: COLORS.textSecondary,
        marginTop: 4,
        textAlign: 'right',
    },
    emptyCard: {
        padding: SPACING.xl,
        alignItems: 'center',
    },
    emptyText: {
        color: COLORS.textSecondary,
    },
    expenseRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: SPACING.sm,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.divider,
    },
    expenseInfo: {
        flex: 1,
    },
    expenseName: {
        fontSize: FONT_SIZES.md,
        color: COLORS.text,
    },
    expenseDate: {
        fontSize: FONT_SIZES.xs,
        color: COLORS.textSecondary,
    },
    expensePrice: {
        fontSize: FONT_SIZES.md,
        fontWeight: '600',
        color: COLORS.text,
    },
});
