import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// The template .env ships "your-project" style placeholders; treat those as unset.
const isPlaceholder = (value: string | undefined) => !value || /your[-_.]/i.test(value);

export const isSupabaseConfigured = !isPlaceholder(url) && !isPlaceholder(anonKey);

/**
 * Null when the project has no Supabase credentials; the app then runs fully
 * offline with sync, sharing and accounts disabled.
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured
    ? createClient(url!, anonKey!, {
          auth: {
              storage: Platform.OS === 'web' ? undefined : AsyncStorage,
              autoRefreshToken: true,
              persistSession: true,
              detectSessionInUrl: Platform.OS === 'web',
          },
          realtime: { params: { eventsPerSecond: 5 } },
      })
    : null;
