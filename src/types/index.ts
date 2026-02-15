// Core type definitions for Grocery Companion

export type Category =
  | 'produce'
  | 'dairy'
  | 'meat'
  | 'bakery'
  | 'frozen'
  | 'pantry'
  | 'beverages'
  | 'household'
  | 'personal_care'
  | 'other';

export interface User {
  id: string;
  email?: string;
  displayName?: string;
  isPro: boolean;
  createdAt: Date;
}

export interface ShoppingList {
  id: string;
  name: string;
  ownerId: string;
  storeId?: string;
  storeName?: string;
  color: string;
  budget?: number;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
  syncVersion: number;
  isSynced: boolean;
}

export interface ListItem {
  id: string;
  listId: string;
  name: string;
  category: Category;
  quantity?: number;
  unit?: string;
  price?: number;
  notes?: string;
  isChecked: boolean;
  isInPantry: boolean;
  addedBy?: string;
  checkedBy?: string;
  createdAt: Date;
  updatedAt: Date;
  syncVersion: number;
  isSynced: boolean;
}

export interface ListCollaborator {
  listId: string;
  userId: string;
  role: 'owner' | 'editor' | 'viewer';
  joinedAt: Date;
}

export interface RecentItem {
  name: string;
  category: Category;
  usageCount: number;
  lastUsed: Date;
}

export interface Store {
  id: string;
  name: string;
  address: string;
  location: {
    lat: number;
    lng: number;
  };
  isOpen?: boolean;
}

export interface SyncOperation {
  id: number;
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  tableName: string;
  recordId: string;
  payload: string;
  createdAt: Date;
  retryCount: number;
}

// Category display configuration
export const CATEGORY_CONFIG: Record<Category, { label: string; icon: string; color: string }> = {
  produce: { label: 'Produce', icon: '🥬', color: '#4CAF50' },
  dairy: { label: 'Dairy', icon: '🥛', color: '#2196F3' },
  meat: { label: 'Meat', icon: '🥩', color: '#F44336' },
  bakery: { label: 'Bakery', icon: '🍞', color: '#FF9800' },
  frozen: { label: 'Frozen', icon: '🧊', color: '#00BCD4' },
  pantry: { label: 'Pantry', icon: '🥫', color: '#795548' },
  beverages: { label: 'Beverages', icon: '🥤', color: '#607D8B' },
  household: { label: 'Household', icon: '🧹', color: '#9C27B0' },
  personal_care: { label: 'Personal Care', icon: '🧴', color: '#E91E63' },
  other: { label: 'Other', icon: '📦', color: '#607D8B' },

};

export interface Ingredient {
  name: string;
  amount: number;
  unit: string;
  category: Category;
}

export interface Recipe {
  id: string;
  title: string;
  description: string;
  image: any; // URL or require source
  prepTime: number; // minutes
  cookTime: number; // minutes
  servings: number;
  calories?: number;
  ingredients: Ingredient[];
  instructions: string[];
  tags: string[];
  isFavorite: boolean;
}

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface MealPlanEntry {
  id: string;
  date: string; // ISO date string (YYYY-MM-DD)
  type: MealType;
  recipeId: string;
}
