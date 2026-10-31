export type StoredRecord = { id: string } & Record<string, unknown>;

/** Rows from the v1 SQLite schema (before the household/sync rewrite). */
export interface LegacyData {
    lists: Record<string, unknown>[];
    items: Record<string, unknown>[];
    recentItems: Record<string, unknown>[];
}

/**
 * Durable key/value-per-table persistence. The LocalDatabase keeps every
 * table in memory and writes through to an adapter.
 */
export interface StorageAdapter {
    init(): Promise<void>;
    loadTable(table: string): Promise<StoredRecord[]>;
    putMany(table: string, records: StoredRecord[]): Promise<void>;
    removeMany(table: string, ids: string[]): Promise<void>;
    getMeta(key: string): Promise<string | null>;
    setMeta(key: string, value: string | null): Promise<void>;
    clearAll(): Promise<void>;
    /** Legacy rows to migrate once, or null when there are none. */
    readLegacy(): Promise<LegacyData | null>;
    /** Keep legacy tables but mark them migrated (never deletes user data). */
    archiveLegacy(): Promise<void>;
}
