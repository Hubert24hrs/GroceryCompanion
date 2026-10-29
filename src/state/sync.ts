import NetInfo from '@react-native-community/netinfo';
import { collection, doc, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { SYNCED_TABLES } from '../domain/types';
import { getDb } from '../data/db';
import { firestore } from '../services/firebase';
import { createFirestoreRemote } from '../sync/firestoreRemote';
import { SyncEngine, SyncState } from '../sync/engine';

/**
 * Drives the SyncEngine: pushes shortly after local edits, syncs on
 * reconnect, on foreground, every minute, and whenever Firestore reports a
 * change in the active household.
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
        const interval = setInterval(() => this.schedule(0), 60_000);
        this.cleanups.push(() => clearInterval(interval));

        // Realtime: watch the newest change in each table and pull when it moves.
        const warn = (e: Error) => console.warn('Live updates paused:', e.message);
        for (const table of SYNCED_TABLES) {
            const latest = query(collection(fs, 'households', householdId, table), orderBy('server_updated_at', 'desc'), limit(1));
            this.cleanups.push(onSnapshot(latest, { includeMetadataChanges: false }, () => this.schedule(400), warn));
        }
        // Role changes, removal, or a rename: refresh the household.
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
