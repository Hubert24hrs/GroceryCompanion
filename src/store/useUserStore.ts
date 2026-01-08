import { create } from 'zustand';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../services/sync/supabase';
import { User } from '../types';

interface UserStore {
    session: Session | null;
    user: User | null;
    isLoading: boolean;
    error: string | null;

    initialize: () => Promise<void>;
    signInAnonymously: () => Promise<void>;
    signOut: () => Promise<void>;
}

export const useUserStore = create<UserStore>((set) => ({
    session: null,
    user: null,
    isLoading: true,
    error: null,

    initialize: async () => {
        try {
            // Get initial session
            const { data: { session } } = await supabase.auth.getSession();

            // Helper to map Supabase user to App User
            const mapUser = async (sbUser: any): Promise<User | null> => {
                if (!sbUser) return null;
                let isPro = false;
                try {
                    const { data } = await supabase.from('profiles').select('is_pro').eq('id', sbUser.id).single();
                    isPro = data?.is_pro || false;
                } catch (e) { /* ignore */ }

                return {
                    id: sbUser.id,
                    email: sbUser.email,
                    isPro,
                    createdAt: new Date(sbUser.created_at),
                };
            };

            const user = await mapUser(session?.user);
            set({ session, user, isLoading: false });

            // Listen for auth changes
            supabase.auth.onAuthStateChange(async (_event, session) => {
                const user = await mapUser(session?.user);
                set({ session, user });
            });
        } catch (error) {
            set({ error: (error as Error).message, isLoading: false });
        }
    },

    signInAnonymously: async () => {
        set({ isLoading: true, error: null });
        try {
            const { error } = await supabase.auth.signInAnonymously();
            if (error) throw error;
            // Session updates automatically via onAuthStateChange
        } catch (error) {
            set({ error: (error as Error).message, isLoading: false });
        }
    },

    signOut: async () => {
        set({ isLoading: true, error: null });
        try {
            const { error } = await supabase.auth.signOut();
            if (error) throw error;
            set({ session: null, user: null });
        } catch (error) {
            set({ error: (error as Error).message, isLoading: false });
        }
    },
}));
