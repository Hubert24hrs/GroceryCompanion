import NetInfo from '@react-native-community/netinfo';
import { RealtimeChannel } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { SYNCED_TABLES } from '../domain/types';
import { getDb } from '../data/db';
import { supabase } from '../services/supabase';
import { SyncEngine, SyncState } from '../sync/engine';
import { createSupabaseRemote } from '../sync/supabaseRemote';

/**
 * Drives the SyncEngine: pushes shortly after local edits, syncs on
 * reconnect, on foreground, every minute, and when Supabase Realtime reports
 * a change in the active household.
 */
class SyncController {
    engine: SyncEngine | null = null;
    private cleanups: (() => void)[] = [];
    private pushTimer: ReturnType<typeof setTimeout> | null = null;
    private onMembershipChange: (() => void) | null = null;

    init() {
        if (!this.engine) this.engine = new SyncEngine(getDb(), null);
        return this.engine;
    }

    start(userId: string, householdId: string, onMembershipChange: () => void) {
        this.stop();
        const engine = this.init();
        if (!supabase) return;
        this.onMembershipChange = onMembershipChange;
        engine.setRemote(createSupabaseRemote(supabase));
        const db = getDb();

        this.cleanups.push(
            db.subscribe(() => {
                engine.refreshCounts();
                if (engine.state.pending > 0) this.schedule(1500);
            }),
        );
        this.cleanups.push(
            NetInfo.addEventListener(s => {
                if (s.isConnected && s.isInternetReachable !== false) this.schedule(300);
            }),
        );
        const appState = AppState.addEventListener('change', s => s === 'active' && this.schedule(0));
        this.cleanups.push(() => appState.remove());
        const interval = setInterval(() => this.schedule(0), 60_000);
        this.cleanups.push(() => clearInterval(interval));

        const channel: RealtimeChannel = supabase.channel(`household:${householdId}`);
        for (const table of SYNCED_TABLES) {
            channel.on('postgres_changes', { event: '*', schema: 'public', table, filter: `household_id=eq.${householdId}` }, () =>
                this.schedule(400),
            );
        }
        channel.on('postgres_changes', { event: '*', schema: 'public', table: 'household_members', filter: `user_id=eq.${userId}` }, () =>
            this.onMembershipChange?.(),
        );
        channel.subscribe();
        this.cleanups.push(() => void supabase?.removeChannel(channel));

        void engine.syncNow();
    }

    schedule(delayMs: number) {
        if (this.pushTimer) clearTimeout(this.pushTimer);
        this.pushTimer = setTimeout(() => {
            this.pushTimer = null;
            void this.engine?.syncNow();
        }, delayMs);
    }

    stop() {
        this.cleanups.forEach(c => c());
        this.cleanups = [];
        if (this.pushTimer) clearTimeout(this.pushTimer);
        this.engine?.setRemote(null);
    }
}

export const syncController = new SyncController();

export function useSyncState(): SyncState {
    const engine = syncController.init();
    const [state, setState] = useState(engine.state);
    useEffect(() => engine.subscribe(setState), [engine]);
    return state;
}
