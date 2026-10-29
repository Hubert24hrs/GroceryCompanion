import AsyncStorage from '@react-native-async-storage/async-storage';
import { v4 as uuidv4 } from 'uuid';
import { Category, Recipe } from '../domain/types';
import { LocalDatabase, setDb } from './db';
import { importLegacy, LegacyMealPlan } from './legacy';
import seedRecipes from './seedRecipes.json';
import { StorageAdapter } from './storage/types';

export const META = {
    localHouseholdId: 'localHouseholdId',
    activeHouseholdId: 'activeHouseholdId',
    seeded: 'seededRecipes',
    legacyMigrated: 'legacyMigrated',
    onboarded: 'onboarded',
    prefs: 'preferences',
    userId: 'userId',
    lastSyncedAt: 'lastSyncedAt',
    seedImagesFixed: 'seedImagesFixed',
} as const;

const LEGACY_MEAL_PLAN_KEY = 'grocery-companion-meal-plan';

type SeedRecipe = Omit<Recipe, 'id' | 'householdId' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'ingredients'> & {
    seedKey: string;
    ingredients: { name: string; quantity: number | null; unit: string | null; category: string }[];
};

/** Add the starter recipes once per household. Returns v1 seed id → new id. */
export function seedStarterRecipes(db: LocalDatabase): Map<string, string> {
    const map = new Map<string, string>();
    for (const seed of seedRecipes as SeedRecipe[]) {
        const { seedKey, ...rest } = seed;
        const recipe = db.insert('recipes', {
            ...rest,
            ingredients: rest.ingredients.map(i => ({ ...i, category: i.category as Category })),
        });
        map.set(seedKey.replace('seed-', ''), recipe.id);
    }
    return map;
}

async function readLegacyMealPlan(): Promise<LegacyMealPlan | null> {
    try {
        const raw = await AsyncStorage.getItem(LEGACY_MEAL_PLAN_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed?.state?.meals) ? { meals: parsed.state.meals } : null;
    } catch {
        return null;
    }
}

/**
 * Open the local store, make sure a household exists, migrate v1 data once
 * and seed starter recipes. Safe to call on every launch.
 */
export async function openLocalDatabase(adapter: StorageAdapter): Promise<LocalDatabase> {
    const db = new LocalDatabase(adapter);
    await db.open();

    let localHouseholdId = await db.getMeta(META.localHouseholdId);
    if (!localHouseholdId) {
        localHouseholdId = uuidv4();
        await db.setMeta(META.localHouseholdId, localHouseholdId);
    }
    const active = (await db.getMeta(META.activeHouseholdId)) ?? localHouseholdId;
    db.setHousehold(active, await db.getMeta(META.userId));

    if (!(await db.getMeta(META.seeded))) {
        const legacy = (await db.getMeta(META.legacyMigrated)) ? null : await adapter.readLegacy();
        const mealPlan = (await db.getMeta(META.legacyMigrated)) ? null : await readLegacyMealPlan();
        const seedIds = seedStarterRecipes(db);
        if (legacy || mealPlan) {
            await importLegacy(db, legacy, mealPlan, seedIds);
            await db.flush();
            await adapter.archiveLegacy();
            await AsyncStorage.removeItem(LEGACY_MEAL_PLAN_KEY).catch(() => undefined);
        }
        await db.setMeta(META.legacyMigrated, '1');
        await db.setMeta(META.seeded, '1');
        await db.flush();
    }

    if (!(await db.getMeta(META.seedImagesFixed))) {
        repairSeedImages(db);
        await db.setMeta(META.seedImagesFixed, '1');
        await db.flush();
    }

    await db.purgeTombstones();
    setDb(db);
    return db;
}

// Unsplash removed these starter-recipe photos; households seeded before the fix still point at them.
const DEAD_SEED_IMAGES: Record<string, string> = {
    'photo-1588137372308-15f75323a4dd': 'https://images.unsplash.com/photo-1588137378633-dea1336ce1e2?q=80&w=1200&auto=format&fit=crop',
    'photo-1488477181946-6428a029177b': 'https://images.unsplash.com/photo-1567769541495-338ee7203e3c?q=80&w=1200&auto=format&fit=crop',
    'photo-1529312266912-b33cf6227e2f': 'https://images.unsplash.com/photo-1769458313937-b5ad8f84942e?q=80&w=1200&auto=format&fit=crop',
};

function repairSeedImages(db: LocalDatabase) {
    for (const r of db.all('recipes')) {
        const dead = Object.keys(DEAD_SEED_IMAGES).find(id => r.imageUrl?.includes(id));
        if (dead && !r.deletedAt) db.update('recipes', r.id, { imageUrl: DEAD_SEED_IMAGES[dead] });
    }
}
