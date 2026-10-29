import { create } from 'zustand';
import { UserPreferences } from '../domain/types';
import { META } from '../data/bootstrap';
import { getDb } from '../data/db';
import { supabase } from '../services/supabase';

export const DEFAULT_PREFS: UserPreferences = {
    householdSize: 2,
    dietary: [],
    monthlyBudget: null,
    currency: 'USD',
    theme: 'system',
    haptics: true,
};

export const DIETARY_OPTIONS = ['vegetarian', 'vegan', 'pescatarian', 'gluten-free', 'dairy-free'];

interface PrefsState {
    prefs: UserPreferences;
    load: () => Promise<void>;
    update: (patch: Partial<UserPreferences>) => Promise<void>;
    /** Merge preferences stored on the account (signed-in users). */
    pullFromProfile: (userId: string) => Promise<void>;
}

export const usePrefs = create<PrefsState>((set, get) => ({
    prefs: DEFAULT_PREFS,

    load: async () => {
        try {
            const raw = await getDb().getMeta(META.prefs);
            if (raw) set({ prefs: { ...DEFAULT_PREFS, ...JSON.parse(raw) } });
        } catch {
            // Keep defaults if stored prefs are unreadable.
        }
    },

    update: async patch => {
        const prefs = { ...get().prefs, ...patch };
        set({ prefs });
        await getDb().setMeta(META.prefs, JSON.stringify(prefs));
        const userId = getDb().actorId;
        if (supabase && userId) {
            const { error } = await supabase
                .from('profiles')
                .update({
                    household_size: prefs.householdSize,
                    dietary_preferences: prefs.dietary,
                    monthly_budget: prefs.monthlyBudget,
                    currency: prefs.currency,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', userId);
            if (error) console.warn('Could not save preferences to your account:', error.message);
        }
    },

    pullFromProfile: async userId => {
        if (!supabase) return;
        const { data } = await supabase
            .from('profiles')
            .select('household_size, dietary_preferences, monthly_budget, currency')
            .eq('id', userId)
            .maybeSingle();
        if (!data) return;
        const prefs: UserPreferences = {
            ...get().prefs,
            householdSize: data.household_size ?? get().prefs.householdSize,
            dietary: data.dietary_preferences ?? get().prefs.dietary,
            monthlyBudget: data.monthly_budget == null ? get().prefs.monthlyBudget : Number(data.monthly_budget),
            currency: data.currency ?? get().prefs.currency,
        };
        set({ prefs });
        await getDb().setMeta(META.prefs, JSON.stringify(prefs));
    },
}));

export function formatMoney(amount: number, currency = usePrefs.getState().prefs.currency): string {
    try {
        return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount);
    } catch {
        return `${currency} ${amount.toFixed(2)}`;
    }
}
