import { useEffect } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { syncEngine } from '../services/sync/syncEngine';
import { useUserStore } from '../store/useUserStore';
import { supabase } from '../services/sync/supabase';

export function useSync() {
    const { session } = useUserStore();

    useEffect(() => {
        if (!session) return;

        // Initial sync on mount/login
        syncEngine.processQueue();
        syncEngine.pullRemoteChanges();

        // 1. Sync on network regain
        const unsubscribeNetInfo = NetInfo.addEventListener(state => {
            if (state.isConnected && state.isInternetReachable) {
                syncEngine.processQueue();
                syncEngine.pullRemoteChanges();
            }
        });

        // 2. Sync on app foreground
        const subscriptionAppState = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
            if (nextAppState === 'active') {
                syncEngine.processQueue();
                syncEngine.pullRemoteChanges();
            }
        });

        // 3. Periodic sync (every 30s) as backup
        const interval = setInterval(() => {
            syncEngine.processQueue();
            syncEngine.pullRemoteChanges();
        }, 30000);

        // 4. Realtime Subscription (Invalidation strategy)
        // When any change happens on relevant tables, trigger a pull
        const channel = supabase.channel('public_db_changes')
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'lists' },
                () => syncEngine.pullRemoteChanges()
            )
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'items' },
                () => syncEngine.pullRemoteChanges()
            )
            .subscribe();

        return () => {
            unsubscribeNetInfo();
            subscriptionAppState.remove();
            clearInterval(interval);
            supabase.removeChannel(channel);
        };
    }, [session]);
}
