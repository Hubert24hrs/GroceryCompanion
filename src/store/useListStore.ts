import { create } from 'zustand';
import { ShoppingList, ListItem, Category, RecentItem } from '../types';
import * as db from '../services/database/sqlite';
import { autoCategorize } from '../services/categorization/autoCategorize';

interface ListStore {
    lists: ShoppingList[];
    currentList: ShoppingList | null;
    items: ListItem[];
    recentItems: RecentItem[];
    isLoading: boolean;
    error: string | null;

    // List actions
    loadLists: () => Promise<void>;
    createList: (name: string, color?: string, budget?: number) => Promise<ShoppingList>;
    selectList: (listId: string) => Promise<void>;
    updateList: (listId: string, updates: Partial<ShoppingList>) => Promise<void>;
    deleteList: (listId: string) => Promise<void>;

    // Item actions
    loadItems: (listId: string) => Promise<void>;
    addItem: (name: string, category?: Category, quantity?: number, unit?: string, price?: number, notes?: string) => Promise<ListItem | null>;
    toggleItem: (itemId: string) => Promise<void>;
    updateItem: (itemId: string, updates: Partial<ListItem>) => Promise<void>;
    deleteItem: (itemId: string) => Promise<void>;
    clearCheckedItems: () => Promise<void>;
    checkout: () => Promise<void>;
    moveToList: (itemId: string) => Promise<void>;

    // Recent items
    loadRecentItems: () => Promise<void>;
    searchRecent: (query: string) => Promise<RecentItem[]>;

    // Utility
    clearError: () => void;
}

export const useListStore = create<ListStore>((set, get) => ({
    lists: [],
    currentList: null,
    items: [],
    recentItems: [],
    isLoading: false,
    error: null,

    // ==================== List Actions ====================

    loadLists: async () => {
        set({ isLoading: true, error: null });
        try {
            const lists = await db.getAllLists();
            set({ lists, isLoading: false });
        } catch (error) {
            set({ error: (error as Error).message, isLoading: false });
        }
    },

    createList: async (name: string, color?: string, budget?: number) => {
        set({ isLoading: true, error: null });
        try {
            const newList = await db.createList(name, color, budget);
            set(state => ({
                lists: [newList, ...state.lists],
                isLoading: false,
            }));
            return newList;
        } catch (error) {
            set({ error: (error as Error).message, isLoading: false });
            throw error;
        }
    },

    selectList: async (listId: string) => {
        set({ isLoading: true, error: null });
        try {
            const list = await db.getListById(listId);
            if (list) {
                const items = await db.getItemsByListId(listId);
                set({ currentList: list, items, isLoading: false });
            } else {
                set({ error: 'List not found', isLoading: false });
            }
        } catch (error) {
            set({ error: (error as Error).message, isLoading: false });
        }
    },

    updateList: async (listId: string, updates: Partial<ShoppingList>) => {
        try {
            await db.updateList(listId, updates);
            set(state => ({
                lists: state.lists.map(l =>
                    l.id === listId ? { ...l, ...updates, updatedAt: new Date() } : l
                ),
                currentList: state.currentList?.id === listId
                    ? { ...state.currentList, ...updates, updatedAt: new Date() }
                    : state.currentList,
            }));
        } catch (error) {
            set({ error: (error as Error).message });
        }
    },

    deleteList: async (listId: string) => {
        try {
            await db.deleteList(listId);
            set(state => ({
                lists: state.lists.filter(l => l.id !== listId),
                currentList: state.currentList?.id === listId ? null : state.currentList,
                items: state.currentList?.id === listId ? [] : state.items,
            }));
        } catch (error) {
            set({ error: (error as Error).message });
        }
    },

    // ==================== Item Actions ====================

    loadItems: async (listId: string) => {
        set({ isLoading: true, error: null });
        try {
            const items = await db.getItemsByListId(listId);
            set({ items, isLoading: false });
        } catch (error) {
            set({ error: (error as Error).message, isLoading: false });
        }
    },

    addItem: async (name: string, category?: Category, quantity?: number, unit?: string, price?: number, notes?: string) => {
        const { currentList } = get();
        if (!currentList) {
            set({ error: 'No list selected' });
            return null;
        }

        try {
            // Auto-categorize if no category provided
            const finalCategory = category || autoCategorize(name);
            const newItem = await db.createItem(currentList.id, name, finalCategory, quantity, unit, price, notes);

            set(state => ({
                items: [...state.items, newItem],
            }));

            return newItem;
        } catch (error) {
            set({ error: (error as Error).message });
            return null;
        }
    },

    toggleItem: async (itemId: string) => {
        try {
            const newState = await db.toggleItemChecked(itemId);
            set(state => ({
                items: state.items.map(item =>
                    item.id === itemId ? { ...item, isChecked: newState, updatedAt: new Date() } : item
                ),
            }));
        } catch (error) {
            set({ error: (error as Error).message });
        }
    },

    updateItem: async (itemId: string, updates: Partial<ListItem>) => {
        try {
            await db.updateItem(itemId, updates);
            set(state => ({
                items: state.items.map(item =>
                    item.id === itemId ? { ...item, ...updates, updatedAt: new Date() } : item
                ),
            }));
        } catch (error) {
            set({ error: (error as Error).message });
        }
    },

    deleteItem: async (itemId: string) => {
        try {
            await db.deleteItem(itemId);
            set(state => ({
                items: state.items.filter(item => item.id !== itemId),
            }));
        } catch (error) {
            set({ error: (error as Error).message });
        }
    },

    clearCheckedItems: async () => {
        const { currentList } = get();
        if (!currentList) return;

        try {
            await db.deleteCheckedItems(currentList.id);
            set(state => ({
                items: state.items.filter(item => !item.isChecked),
            }));
        } catch (error) {
            set({ error: (error as Error).message });
        }
    },

    checkout: async () => {
        const { currentList } = get();
        if (!currentList) return;

        try {
            await db.moveCheckedToPantry(currentList.id);
            set(state => ({
                items: state.items.map(item =>
                    item.isChecked
                        ? { ...item, isChecked: false, isInPantry: true, updatedAt: new Date() }
                        : item
                ),
            }));
        } catch (error) {
            set({ error: (error as Error).message });
        }
    },

    moveToList: async (itemId: string) => {
        try {
            await db.updateItem(itemId, { isInPantry: false, isChecked: false });
            set(state => ({
                items: state.items.map(item =>
                    item.id === itemId
                        ? { ...item, isInPantry: false, isChecked: false, updatedAt: new Date() }
                        : item
                ),
            }));
        } catch (error) {
            set({ error: (error as Error).message });
        }
    },

    // ==================== Recent Items ====================

    loadRecentItems: async () => {
        try {
            const recentItems = await db.getRecentItems();
            set({ recentItems });
        } catch (error) {
            set({ error: (error as Error).message });
        }
    },

    searchRecent: async (query: string) => {
        try {
            return await db.searchRecentItems(query);
        } catch (error) {
            return [];
        }
    },

    // ==================== Utility ====================

    clearError: () => set({ error: null }),
}));

// Selector hooks for optimized re-renders
export const useCurrentList = () => useListStore(state => state.currentList);
export const useItems = () => useListStore(state => state.items);
export const useLists = () => useListStore(state => state.lists);
export const useRecentItems = () => useListStore(state => state.recentItems);
export const useIsLoading = () => useListStore(state => state.isLoading);
export const useError = () => useListStore(state => state.error);

// Grouped items by category
export const useItemsByCategory = () => {
    const items = useListStore(state => state.items);

    return items.reduce((acc, item) => {
        if (item.isInPantry) return acc; // Filter out pantry items

        if (!acc[item.category]) {
            acc[item.category] = [];
        }
        acc[item.category].push(item);
        return acc;
    }, {} as Record<Category, ListItem[]>);
};

// Pantry items grouped by category
export const usePantryItemsByCategory = () => {
    const items = useListStore(state => state.items);

    return items.reduce((acc, item) => {
        if (!item.isInPantry) return acc; // Only include pantry items

        if (!acc[item.category]) {
            acc[item.category] = [];
        }
        acc[item.category].push(item);
        return acc;
    }, {} as Record<Category, ListItem[]>);
};

// Unchecked items count
export const useUncheckedCount = () => {
    const items = useListStore(state => state.items);
    return items.filter(item => !item.isChecked && !item.isInPantry).length;
};

// Checked items count
export const useCheckedCount = () => {
    const items = useListStore(state => state.items);
    return items.filter(item => item.isChecked && !item.isInPantry).length;
};
