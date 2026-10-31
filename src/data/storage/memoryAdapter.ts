import { LegacyData, StorageAdapter, StoredRecord } from './types';

/** In-memory adapter for tests and as a last-resort fallback. */
export class MemoryAdapter implements StorageAdapter {
    tables = new Map<string, Map<string, StoredRecord>>();
    meta = new Map<string, string>();
    legacy: LegacyData | null = null;
    writes = 0;

    async init(): Promise<void> {}

    async loadTable(table: string): Promise<StoredRecord[]> {
        return [...(this.tables.get(table)?.values() ?? [])].map(r => structuredCloneSafe(r));
    }

    async putMany(table: string, records: StoredRecord[]): Promise<void> {
        const map = this.tables.get(table) ?? new Map();
        for (const r of records) map.set(r.id, structuredCloneSafe(r));
        this.tables.set(table, map);
        this.writes++;
    }

    async removeMany(table: string, ids: string[]): Promise<void> {
        const map = this.tables.get(table);
        if (map) for (const id of ids) map.delete(id);
        this.writes++;
    }

    async getMeta(key: string): Promise<string | null> {
        return this.meta.get(key) ?? null;
    }

    async setMeta(key: string, value: string | null): Promise<void> {
        if (value == null) this.meta.delete(key);
        else this.meta.set(key, value);
    }

    async clearAll(): Promise<void> {
        this.tables.clear();
        this.meta.clear();
    }

    async readLegacy(): Promise<LegacyData | null> {
        return this.legacy;
    }

    async archiveLegacy(): Promise<void> {
        this.legacy = null;
    }
}

function structuredCloneSafe<T>(value: T): T {
    return JSON.parse(JSON.stringify(value));
}
