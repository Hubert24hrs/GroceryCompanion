import NetInfo from '@react-native-community/netinfo';
import { useIsFocused } from '@react-navigation/native';
import { collection, doc, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { getDb } from '../data/db';
import { firestore } from '../services/firebase';
import { createFirestoreRemote } from '../sync/firestoreRemote';
import { SyncEngine, SyncState } from '../sync/engine';

/**
 * Drives the SyncEngine: pushes shortly after local edits, syncs on reconnect,
 * on foreground and on pull-to-refresh, and retries unsent changes every
 * minute. Live updates are Pro: see watchList.
 */
class SyncController {
    engine: SyncEngine | null = null;
    private cleanups: (() => void)[] = [];
    private pushTimer: ReturnType<typeof setTimeout> | null = null;

    init() {
        if (!this.engine) this.engine = new SyncEngine(getDb(), null);
        return this.engine;
    }

    start(userId: string, householdId: string, onMembershipChange: () => void) {
        this.stop();
        const engine = this.init();
        if (!firestore) return;
        const fs = firestore;
        const db = getDb();
        engine.setRemote(createFirestoreRemote(fs, () => db.householdId));

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
        const interval = setInterval(() => engine.state.pending > 0 && this.schedule(0), 60_000);
        this.cleanups.push(() => clearInterval(interval));

        const warn = (e: Error) => console.warn('Household updates paused:', e.message);
        // Role changes, removal, a rename, or the owner's Pro: refresh the household.
        let seenMember = false;
        this.cleanups.push(
            onSnapshot(
                doc(fs, 'households', householdId, 'members', userId),
                () => {
                    if (seenMember) onMembershipChange();
                    seenMember = true;
                },
                () => onMembershipChange(),
            ),
        );
        let seenHousehold = false;
        this.cleanups.push(
            onSnapshot(
                doc(fs, 'households', householdId),
                () => {
                    if (seenHousehold) onMembershipChange();
                    seenHousehold = true;
                },
                warn,
            ),
        );

        void engine.syncNow();
    }

    /**
     * Pull whenever the newest item of one list changes. Reading a single
     * row keeps the listener cheap, and the rules only allow this query for
     * Pro households.
     */
    watchList(listId: string): () => void {
        if (!firestore) return () => undefined;
        const items = collection(firestore, 'households', getDb().householdId, 'items');
        const latest = query(items, where('list_id', '==', listId), orderBy('server_updated_at', 'desc'), limit(1));
        return onSnapshot(latest, { includeMetadataChanges: false }, () => this.schedule(400), e => console.warn('Live updates paused:', e.message));
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

/** Live updates for the list on screen; stops off screen and in the background. */
export function useLiveList(listId: string, enabled: boolean) {
    const focused = useIsFocused();
    const [foreground, setForeground] = useState(AppState.currentState === 'active');
    useEffect(() => {
        const sub = AppState.addEventListener('change', s => setForeground(s === 'active'));
        return () => sub.remove();
    }, []);
    useEffect(() => {
        if (enabled && focused && foreground) return syncController.watchList(listId);
    }, [enabled, focused, foreground, listId]);
}

/** Pull-to-refresh: a full sync, spinning until it ends. */
export function useSyncRefresh() {
    const [refreshing, setRefreshing] = useState(false);
    const onRefresh = useCallback(() => {
        setRefreshing(true);
        void syncController.init().syncNow().finally(() => setRefreshing(false));
    }, []);
    return { refreshing, onRefresh };
}
