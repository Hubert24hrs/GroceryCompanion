import { SYNCED_TABLES, SyncedRecord, SyncedTable, TableRecordMap } from '../domain/types';
import { LocalDatabase, OutboxEntry } from '../data/db';
import { fromRemote, RemoteRow, toRemote } from './mapping';

export class RemoteError extends Error {
    constructor(
        message: string,
        /** Network/timeouts/5xx/rate limits: try again later. */
        readonly retryable: boolean,
        readonly code?: string,
    ) {
        super(message);
    }
}

export interface PullCursor {
    serverUpdatedAt: string;
    id: string;
}

export interface RemoteApi {
    upsert(table: SyncedTable, rows: RemoteRow[]): Promise<void>;
    /** Rows changed after the cursor, ordered by (server_updated_at, id). */
    pull(table: SyncedTable, after: PullCursor | null, limit: number): Promise<(RemoteRow & { server_updated_at: string })[]>;
}

export type SyncStatus = 'idle' | 'syncing' | 'offline' | 'error' | 'disabled';

export interface SyncState {
    status: SyncStatus;
    lastSyncedAt: string | null;
    pending: number;
    failed: OutboxEntry[];
    lastError: string | null;
}

// Parents first so foreign keys (items → lists) are satisfied.
const PUSH_ORDER: SyncedTable[] = ['lists', 'recipes', 'items', 'pantry_items', 'meal_plan_entries', 'purchases'];

export const MAX_ATTEMPTS = 6;

/** 2s, 4s, 8s … capped at 10 minutes, with ±20% jitter. */
export function backoffMs(attempts: number, random = Math.random): number {
    const base = Math.min(600_000, 2000 * 2 ** Math.max(0, attempts - 1));
    return Math.round(base * (0.8 + random() * 0.4));
}

/**
 * Two-way sync between the local outbox and the remote (Firestore).
 *
 * Push: every queued record is sent as a full-row upsert keyed by its client
 * UUID, so retries are idempotent. Writes older than the stored row are skipped
 * (last writer wins on updated_at; the security rules enforce it too).
 *
 * Pull: per-table cursor on (server_updated_at, id), paged. A remote row
 * replaces the local one unless the local copy has a newer unsynced change.
 */
export class SyncEngine {
    private running: Promise<void> | null = null;
    private rerun = false;
    private listeners = new Set<(s: SyncState) => void>();
    state: SyncState = { status: 'disabled', lastSyncedAt: null, pending: 0, failed: [], lastError: null };

    constructor(
        private db: LocalDatabase,
        private remote: RemoteApi | null,
        private opts: { now?: () => Date; pageSize?: number; batchSize?: number; random?: () => number } = {},
    ) {
        this.refreshCounts();
    }

    private now() {
        return this.opts.now?.() ?? new Date();
    }

    setRemote(remote: RemoteApi | null) {
        this.remote = remote;
        this.setState({ status: remote ? 'idle' : 'disabled' });
    }

    subscribe(listener: (s: SyncState) => void): () => void {
        this.listeners.add(listener);
        listener(this.state);
        return () => this.listeners.delete(listener);
    }

    private setState(patch: Partial<SyncState>) {
        this.state = { ...this.state, ...patch };
        this.listeners.forEach(l => l(this.state));
    }

    refreshCounts() {
        const all = this.db.pendingOutbox();
        this.setState({ pending: all.filter(e => !e.failed).length, failed: all.filter(e => e.failed) });
    }

    /** Push then pull. Concurrent calls coalesce into one extra run. */
    syncNow(): Promise<void> {
        if (!this.remote) return Promise.resolve();
        if (this.running) {
            this.rerun = true;
            return this.running;
        }
        this.running = (async () => {
            try {
                do {
                    this.rerun = false;
                    await this.runOnce();
                } while (this.rerun);
            } finally {
                this.running = null;
            }
        })();
        return this.running;
    }

    private async runOnce() {
        this.setState({ status: 'syncing' });
        try {
            await this.push();
            await this.pull();
            const lastSyncedAt = this.now().toISOString();
            await this.db.flush();
            this.setState({ status: 'idle', lastSyncedAt, lastError: null });
        } catch (e) {
            const err = e as RemoteError;
            this.setState({ status: err.retryable === false ? 'error' : 'offline', lastError: err.message });
        } finally {
            this.refreshCounts();
        }
    }

    // ─────────────────────────── push ───────────────────────────

    async push(): Promise<void> {
        const remote = this.remote!;
        const nowIso = this.now().toISOString();
        const due = this.db
            .pendingOutbox()
            .filter(e => !e.failed && (!e.nextAttemptAt || e.nextAttemptAt <= nowIso));

        for (const table of PUSH_ORDER) {
            const entries = due.filter(e => e.table === table);
            const batchSize = this.opts.batchSize ?? 100;
            for (let i = 0; i < entries.length; i += batchSize) {
                const batch = entries.slice(i, i + batchSize);
                const snapshot = batch
                    .map(e => ({ entry: e, record: this.db.get(table, e.recordId) as TableRecordMap[typeof table] | undefined }))
                    .filter(x => {
                        if (!x.record) this.db.dropOutbox(table, x.entry.recordId); // record purged locally
                        return !!x.record;
                    }) as { entry: OutboxEntry; record: SyncedRecord }[];
                if (!snapshot.length) continue;

                try {
                    await remote.upsert(table, snapshot.map(s => toRemote(table, s.record as TableRecordMap[typeof table])));
                    snapshot.forEach(s => this.ack(table, s.record));
                } catch (e) {
                    const err = toRemoteError(e);
                    if (err.retryable) throw err; // offline: keep everything queued
                    // A data error in one row must not block the rest: retry rows one by one.
                    for (const s of snapshot) {
                        try {
                            await remote.upsert(table, [toRemote(table, s.record as TableRecordMap[typeof table])]);
                            this.ack(table, s.record);
                        } catch (rowError) {
                            const re = toRemoteError(rowError);
                            if (re.retryable) throw re;
                            this.fail(s.entry, re);
                        }
                    }
                }
            }
        }
    }

    /** Clear the outbox entry unless the record changed again while in flight. */
    private ack(table: SyncedTable, pushed: SyncedRecord) {
        const current = this.db.get(table, pushed.id) as SyncedRecord | undefined;
        if (!current || current.updatedAt === pushed.updatedAt) this.db.dropOutbox(table, pushed.id);
    }

    private fail(entry: OutboxEntry, error: RemoteError) {
        const attempts = entry.attempts + 1;
        this.db.updateOutbox({
            ...entry,
            attempts,
            lastError: error.message,
            failed: attempts >= MAX_ATTEMPTS,
            nextAttemptAt: new Date(this.now().getTime() + backoffMs(attempts, this.opts.random)).toISOString(),
        });
    }

    /** Re-queue dead-lettered changes (user tapped "Retry"). */
    retryFailed(): Promise<void> {
        for (const e of this.db.pendingOutbox()) {
            if (e.failed) this.db.updateOutbox({ ...e, failed: false, attempts: 0, nextAttemptAt: null });
        }
        this.refreshCounts();
        return this.syncNow();
    }

    /** Throw away a dead-lettered local change and take the server's copy on next pull. */
    async discardFailed(entry: OutboxEntry): Promise<void> {
        this.db.dropOutbox(entry.table, entry.recordId);
        await this.db.setMeta(cursorKey(entry.table), null); // re-pull this table fully
        this.refreshCounts();
    }

    // ─────────────────────────── pull ───────────────────────────

    async pull(): Promise<void> {
        const remote = this.remote!;
        const pageSize = this.opts.pageSize ?? 500;
        for (const table of SYNCED_TABLES) {
            let cursor = parseCursor(await this.db.getMeta(cursorKey(table)));
            // Nothing stored for this household: a saved position would skip every row.
            if (cursor && !this.hasLocalRows(table)) cursor = null;
            for (;;) {
                const rows = await remote.pull(table, cursor, pageSize).catch(e => {
                    throw toRemoteError(e);
                });
                await this.db.transaction(() => rows.forEach(row => this.merge(table, row)));
                if (rows.length) {
                    const last = rows[rows.length - 1];
                    cursor = { serverUpdatedAt: last.server_updated_at, id: String(last.id) };
                    await this.db.setMeta(cursorKey(table), JSON.stringify(cursor));
                }
                if (rows.length < pageSize) break;
            }
        }
    }

    private hasLocalRows(table: SyncedTable): boolean {
        return (this.db.all(table) as SyncedRecord[]).some(r => r.householdId === this.db.householdId);
    }

    merge<T extends SyncedTable>(table: T, row: RemoteRow): void {
        const incoming = fromRemote(table, row);
        const local = this.db.get(table, incoming.id) as SyncedRecord | undefined;
        if (local && this.db.hasPending(table, incoming.id)) {
            if (local.updatedAt > incoming.updatedAt) return; // our newer edit will be pushed
            this.db.dropOutbox(table, incoming.id); // the server's copy is newer: it wins
        }
        if (local && local.updatedAt === incoming.updatedAt && local.deletedAt === incoming.deletedAt) {
            // Same version we already have — avoid re-rendering. Still refresh in case
            // the server normalised a field.
            if (JSON.stringify(toRemote(table, local as TableRecordMap[T])) === JSON.stringify(toRemote(table, incoming))) return;
        }
        this.db.applyRemote(table, incoming);
    }

    /** Forget pull cursors (e.g. after switching account). */
    async resetCursors(): Promise<void> {
        for (const table of SYNCED_TABLES) await this.db.setMeta(cursorKey(table), null);
    }
}

const cursorKey = (table: SyncedTable) => `cursor:${table}`;

function parseCursor(raw: string | null): PullCursor | null {
    if (!raw) return null;
    try {
        const c = JSON.parse(raw);
        return typeof c?.serverUpdatedAt === 'string' && typeof c?.id === 'string' ? c : null;
    } catch {
        return null;
    }
}

export function toRemoteError(e: unknown): RemoteError {
    if (e instanceof RemoteError) return e;
    const msg = e instanceof Error ? e.message : String(e);
    return new RemoteError(msg, true);
}
