import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Replace these with your actual Supabase project credentials
// In a real app, these should be in environment variables (e.g. .env)
const SUPABASE_URL = 'https://mudkbupxqeghkvgrvkjt.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_qgNRsw1pPHJR_SVMRuQSeg_YHmnTK4E';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
    },
});
