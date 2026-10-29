// Core domain types. Dates are ISO-8601 strings so records serialize
// identically to SQLite, localStorage and Supabase.

export type Category =
    | 'produce'
    | 'dairy'
    | 'meat'
    | 'seafood'
    | 'bakery'
    | 'frozen'
    | 'pantry'
    | 'snacks'
    | 'beverages'
    | 'household'
    | 'personal_care'
    | 'baby'
    | 'pets'
    | 'other';

export type Role = 'owner' | 'editor' | 'viewer';

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

/** Fields shared by every record that syncs to Supabase. */
export interface SyncedRecord {
    id: string;
    householdId: string;
    createdAt: string;
    updatedAt: string;
    deletedAt: string | null;
}

export interface ShoppingList extends SyncedRecord {
    name: string;
    color: string;
    icon: string;
    storeName: string | null;
    storeId: string | null;
    budget: number | null;
    sortOrder: number;
    isArchived: boolean;
    isTemplate: boolean;
    ownerId: string | null;
}

export interface ListItem extends SyncedRecord {
    listId: string;
    name: string;
    category: Category;
    quantity: number | null;
    unit: string | null;
    notes: string | null;
    price: number | null;
    isChecked: boolean;
    checkedAt: string | null;
    barcode: string | null;
    recipeId: string | null;
    addedBy: string | null;
    checkedBy: string | null;
}

export type PantryLocation = 'fridge' | 'freezer' | 'pantry' | 'other';

export interface PantryItem extends SyncedRecord {
    name: string;
    category: Category;
    quantity: number;
    unit: string | null;
    lowStockThreshold: number | null;
    expiresOn: string | null; // YYYY-MM-DD
    location: PantryLocation;
    barcode: string | null;
    notes: string | null;
}

export interface Ingredient {
    name: string;
    quantity: number | null;
    unit: string | null;
    category: Category;
    note?: string | null;
}

export interface Recipe extends SyncedRecord {
    title: string;
    description: string | null;
    imageUrl: string | null;
    sourceName: string | null;
    sourceUrl: string | null;
    prepMinutes: number | null;
    cookMinutes: number | null;
    servings: number;
    calories: number | null;
    ingredients: Ingredient[];
    instructions: string[];
    tags: string[];
    collection: string | null;
    isFavorite: boolean;
    estimatedCost: number | null;
}

export interface MealPlanEntry extends SyncedRecord {
    date: string; // YYYY-MM-DD
    mealType: MealType;
    recipeId: string | null;
    title: string | null; // free-text meal when no recipe
    servings: number | null;
}

export interface Purchase extends SyncedRecord {
    listId: string | null;
    name: string;
    category: Category;
    quantity: number | null;
    unit: string | null;
    price: number; // total paid for this line
    storeName: string | null;
    purchasedAt: string;
}

export interface RecentItem {
    id: string; // normalized name
    name: string;
    category: Category;
    unit: string | null;
    useCount: number;
    lastUsed: string;
}

export interface BarcodeEntry {
    id: string; // the barcode
    name: string;
    brand: string | null;
    category: Category;
    quantityLabel: string | null;
    imageUrl: string | null;
    source: 'openfoodfacts' | 'user';
    updatedAt: string;
}

export interface Household {
    id: string;
    name: string;
    ownerId: string;
}

export interface HouseholdMember {
    householdId: string;
    userId: string;
    role: Role;
    email: string | null;
    displayName: string | null;
    joinedAt: string;
}

export interface Invite {
    code: string;
    householdId: string;
    role: Role;
    expiresAt: string;
    maxUses: number;
    useCount: number;
}

export interface UserPreferences {
    householdSize: number;
    dietary: string[]; // e.g. ['vegetarian', 'gluten-free']
    monthlyBudget: number | null;
    currency: string;
    theme: 'system' | 'light' | 'dark';
    haptics: boolean;
}

export const SYNCED_TABLES = ['lists', 'items', 'pantry_items', 'recipes', 'meal_plan_entries', 'purchases'] as const;
export type SyncedTable = (typeof SYNCED_TABLES)[number];

export interface TableRecordMap {
    lists: ShoppingList;
    items: ListItem;
    pantry_items: PantryItem;
    recipes: Recipe;
    meal_plan_entries: MealPlanEntry;
    purchases: Purchase;
}
