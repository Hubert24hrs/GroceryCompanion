import { v4 as uuidv4 } from 'uuid';
import { BarcodeEntry, RecentItem, SYNCED_TABLES, SyncedRecord, SyncedTable, TableRecordMap } from '../domain/types';
import { StorageAdapter, StoredRecord } from './storage/types';

export interface OutboxEntry {
    id: string; // `${table}:${recordId}` — one entry per record, so repeated edits coalesce
    table: SyncedTable;
    recordId: string;
    queuedAt: string;
    attempts: number;
    nextAttemptAt: string | null;
    lastError: string | null;
    failed: boolean;
}

interface LocalOnlyTables {
    recent_items: RecentItem;
    barcodes: BarcodeEntry;
    outbox: OutboxEntry;
}

export type AllTables = TableRecordMap & LocalOnlyTables;
export type LocalTable = keyof AllTables;
export type NewRecord<T extends SyncedTable> = Omit<TableRecordMap[T], keyof SyncedRecord> & { id?: string };

const LOCAL_TABLES: LocalTable[] = [...SYNCED_TABLES, 'recent_items', 'barcodes', 'outbox'];

const isSynced = (table: LocalTable): table is SyncedTable => (SYNCED_TABLES as readonly string[]).includes(table);

/**
 * Offline-first record store. Every table lives in memory for instant reads;
 * writes update memory synchronously, notify subscribers, then persist through
 * the adapter in order. Writes to synced tables also queue an outbox entry.
 */
export class LocalDatabase {
    private data = new Map<LocalTable, Map<string, StoredRecord>>();
    private snapshots = new Map<LocalTable, unknown[]>();
    private dirty = new Map<LocalTable, Map<string, StoredRecord | null>>();
    private listeners = new Set<() => void>();
    private errorListeners = new Set<(e: Error) => void>();
    private persistChain: Promise<void> = Promise.resolve();
    private batchDepth = 0;

    householdId = '';
    actorId: string | null = null;

    constructor(
        readonly adapter: StorageAdapter,
        private now: () => string = () => new Date().toISOString(),
        private newId: () => string = uuidv4,
    ) {}

    async open(): Promise<void> {
        await this.adapter.init();
        for (const table of LOCAL_TABLES) {
            const rows = await this.adapter.loadTable(table);
            this.data.set(table, new Map(rows.map(r => [r.id, r])));
        }
    }

    // ───────────────────────── reads ─────────────────────────

    get<T extends LocalTable>(table: T, id: string): AllTables[T] | undefined {
        return this.data.get(table)?.get(id) as AllTables[T] | undefined;
    }

    /** Every row, including tombstones and other households. */
    all<T extends LocalTable>(table: T): AllTables[T][] {
        return [...(this.data.get(table)?.values() ?? [])] as unknown as AllTables[T][];
    }

    /**
     * Live rows of the active household. The array identity only changes when
     * the table changes, so it is safe as a useSyncExternalStore snapshot.
     */
    list<T extends LocalTable>(table: T): AllTables[T][] {
        let snap = this.snapshots.get(table);
        if (!snap) {
            const rows = this.all(table);
            snap = isSynced(table)
                ? (rows as unknown as SyncedRecord[]).filter(r => !r.deletedAt && r.householdId === this.householdId)
                : rows;
            this.snapshots.set(table, snap);
        }
        return snap as AllTables[T][];
    }

    subscribe(listener: () => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    onError(listener: (e: Error) => void): () => void {
        this.errorListeners.add(listener);
        return () => this.errorListeners.delete(listener);
    }

    // ───────────────────────── writes ─────────────────────────

    private stage(table: LocalTable, id: string, record: StoredRecord | null) {
        const map = this.data.get(table)!;
        if (record) map.set(id, record);
        else map.delete(id);
        const d = this.dirty.get(table) ?? new Map();
        d.set(id, record);
        this.dirty.set(table, d);
        this.snapshots.delete(table);
    }

    private queue(table: SyncedTable, recordId: string) {
        const id = `${table}:${recordId}`;
        const entry: OutboxEntry = {
            id,
            table,
            recordId,
            queuedAt: this.now(),
            attempts: 0,
            nextAttemptAt: null,
            lastError: null,
            failed: false,
        };
        this.stage('outbox', id, entry as unknown as StoredRecord);
    }

    private commit(): Promise<void> {
        if (this.batchDepth > 0) return Promise.resolve();
        const dirty = this.dirty;
        this.dirty = new Map();
        if (dirty.size === 0) return this.persistChain;
        this.listeners.forEach(l => l());
        this.persistChain = this.persistChain.then(async () => {
            try {
                for (const [table, rows] of dirty) {
                    const puts: StoredRecord[] = [];
                    const removes: string[] = [];
                    rows.forEach((rec, id) => (rec ? puts.push(rec) : removes.push(id)));
                    await this.adapter.putMany(table, puts);
                    await this.adapter.removeMany(table, removes);
                }
            } catch (e) {
                this.errorListeners.forEach(l => l(e as Error));
            }
        });
        return this.persistChain;
    }

    /** Group writes so subscribers render once and storage gets one batch. */
    async transaction<R>(fn: () => R | Promise<R>): Promise<R> {
        this.batchDepth++;
        let result: R;
        try {
            result = await fn();
        } finally {
            this.batchDepth--;
        }
        await this.commit();
        return result;
    }

    /** Resolves once everything written so far is on disk. */
    flush(): Promise<void> {
        return this.persistChain;
    }

    insert<T extends SyncedTable>(table: T, values: NewRecord<T>): TableRecordMap[T] {
        const ts = this.now();
        const record = {
            ...values,
            id: values.id ?? this.newId(),
            householdId: this.householdId,
            createdAt: ts,
            updatedAt: ts,
            deletedAt: null,
        } as unknown as TableRecordMap[T];
        this.stage(table, record.id, record as unknown as StoredRecord);
        this.queue(table, record.id);
        void this.commit();
        return record;
    }

    update<T extends SyncedTable>(table: T, id: string, patch: Partial<TableRecordMap[T]>): TableRecordMap[T] | undefined {
        const current = this.get(table, id) as TableRecordMap[T] | undefined;
        if (!current) return undefined;
        const { id: _id, householdId: _h, createdAt: _c, ...safe } = patch as Partial<SyncedRecord>;
        // updatedAt must strictly increase or last-writer-wins can't order two quick edits.
        const ts = this.now();
        const updatedAt = ts > current.updatedAt ? ts : new Date(Date.parse(current.updatedAt) + 1).toISOString();
        const next = { ...current, ...safe, updatedAt } as TableRecordMap[T];
        this.stage(table, id, next as unknown as StoredRecord);
        this.queue(table, id);
        void this.commit();
        return next;
    }

    /** Soft delete: the tombstone syncs so other devices remove it too. */
    remove<T extends SyncedTable>(table: T, id: string): void {
        const current = this.get(table, id) as SyncedRecord | undefined;
        if (!current || current.deletedAt) return;
        this.update(table, id, { deletedAt: this.now() } as Partial<TableRecordMap[T]>);
    }

    /** Local-only tables (recent items, barcode cache). */
    putLocal<T extends Exclude<LocalTable, SyncedTable>>(table: T, record: AllTables[T]): void {
        this.stage(table, record.id, record as unknown as StoredRecord);
        void this.commit();
    }

    deleteLocal<T extends Exclude<LocalTable, SyncedTable>>(table: T, id: string): void {
        if (!this.get(table, id)) return;
        this.stage(table, id, null);
        void this.commit();
    }

    // ─────────────────────── sync support ───────────────────────

    /** Write a server row without queuing it back to the server. */
    applyRemote<T extends SyncedTable>(table: T, record: TableRecordMap[T]): void {
        this.stage(table, record.id, record as unknown as StoredRecord);
        void this.commit();
    }

    pendingOutbox(): OutboxEntry[] {
        return this.all('outbox').sort((a, b) => a.queuedAt.localeCompare(b.queuedAt));
    }

    hasPending(table: SyncedTable, recordId: string): boolean {
        return !!this.get('outbox', `${table}:${recordId}`);
    }

    updateOutbox(entry: OutboxEntry): void {
        this.putLocalUnsafe('outbox', entry);
    }

    dropOutbox(table: SyncedTable, recordId: string): void {
        this.deleteLocal('outbox', `${table}:${recordId}`);
    }

    private putLocalUnsafe(table: LocalTable, record: { id: string }) {
        this.stage(table, record.id, record as StoredRecord);
        void this.commit();
    }

    /** Forget one local record without telling the server (e.g. unused starter recipes). */
    discardLocal(table: SyncedTable, id: string): void {
        this.stage(table, id, null);
        if (this.hasPending(table, id)) this.stage('outbox', `${table}:${id}`, null);
        void this.commit();
    }

    /** Move records created before sign-in into the account's household. */
    reassignHousehold(fromId: string, toId: string): Promise<void> {
        return this.transaction(() => {
            for (const table of SYNCED_TABLES) {
                for (const row of this.all(table)) {
                    if (row.householdId !== fromId) continue;
                    const next = { ...row, householdId: toId, updatedAt: this.now() };
                    this.stage(table, row.id, next as unknown as StoredRecord);
                    this.queue(table, row.id);
                }
            }
        });
    }

    /** Forget a household's rows locally (e.g. after leaving it). No outbox. */
    removeHouseholdData(householdId: string): Promise<void> {
        return this.transaction(() => {
            for (const table of SYNCED_TABLES) {
                for (const row of this.all(table)) {
                    if (row.householdId !== householdId) continue;
                    this.stage(table, row.id, null);
                    if (this.hasPending(table, row.id)) this.stage('outbox', `${table}:${row.id}`, null);
                }
            }
        });
    }

    /** Hard-delete synced tombstones older than `days` to keep storage small. */
    purgeTombstones(days = 30): Promise<void> {
        const cutoff = new Date(Date.parse(this.now()) - days * 86_400_000).toISOString();
        return this.transaction(() => {
            for (const table of SYNCED_TABLES) {
                for (const row of this.all(table)) {
                    if (row.deletedAt && row.deletedAt < cutoff && !this.hasPending(table, row.id)) {
                        this.stage(table, row.id, null);
                    }
                }
            }
        });
    }

    setHousehold(householdId: string, actorId: string | null): void {
        this.householdId = householdId;
        this.actorId = actorId;
        this.snapshots.clear();
        this.listeners.forEach(l => l());
    }

    getMeta(key: string) {
        return this.adapter.getMeta(key);
    }

    setMeta(key: string, value: string | null) {
        return this.adapter.setMeta(key, value);
    }

    async clearAll(): Promise<void> {
        await this.flush();
        await this.adapter.clearAll();
        for (const table of LOCAL_TABLES) this.data.set(table, new Map());
        this.snapshots.clear();
        this.listeners.forEach(l => l());
    }
}

let instance: LocalDatabase | null = null;

export function getDb(): LocalDatabase {
    if (!instance) throw new Error('Local database not initialised');
    return instance;
}

export function setDb(db: LocalDatabase | null): void {
    instance = db;
}
