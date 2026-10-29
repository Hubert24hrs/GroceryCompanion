import { create } from 'zustand';
import { UserPreferences } from '../domain/types';
import { META } from '../data/bootstrap';
import { getDb } from '../data/db';
import { isBackendConfigured } from '../services/firebase';
import { loadProfile, saveProfile } from '../services/household';

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
        if (isBackendConfigured && userId) {
            await saveProfile(userId, prefs).catch(e => console.warn('Could not save preferences to your account:', (e as Error).message));
        }
    },

    pullFromProfile: async userId => {
        if (!isBackendConfigured) return;
        const remote = await loadProfile(userId).catch(() => null);
        if (!remote) {
            // First sign-in: the account starts with this device's preferences.
            await saveProfile(userId, get().prefs).catch(() => undefined);
            return;
        }
        const current = get().prefs;
        const prefs: UserPreferences = {
            ...current,
            householdSize: remote.householdSize ?? current.householdSize,
            dietary: remote.dietary ?? current.dietary,
            monthlyBudget: remote.monthlyBudget === undefined ? current.monthlyBudget : remote.monthlyBudget,
            currency: remote.currency ?? current.currency,
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
