import { LegacyData, StorageAdapter, StoredRecord } from './types';

const PREFIX = 'gc:v2:';

/**
 * Browser persistence on localStorage: one JSON object per table. Household
 * data is small (hundreds to a few thousand rows), well inside the quota.
 */
export class WebStorageAdapter implements StorageAdapter {
    constructor(private storage: Storage = globalThis.localStorage) {}

    async init(): Promise<void> {
        if (!this.storage) throw new Error('localStorage is not available');
    }

    // Always the stored copy: another tab may have written since, and writing back
    // an older copy would erase its rows while the shared pull cursor stays ahead.
    private read(table: string): Record<string, StoredRecord> {
        try {
            return JSON.parse(this.storage.getItem(PREFIX + table) ?? '{}') as Record<string, StoredRecord>;
        } catch {
            return {};
        }
    }

    private write(table: string, data: Record<string, StoredRecord>) {
        try {
            this.storage.setItem(PREFIX + table, JSON.stringify(data));
        } catch (e) {
            throw new Error(`Couldn't save on this device (${(e as Error).name}). Free some browser storage and try again.`);
        }
    }

    async loadTable(table: string): Promise<StoredRecord[]> {
        return Object.values(this.read(table));
    }

    async putMany(table: string, records: StoredRecord[]): Promise<void> {
        const data = this.read(table);
        for (const r of records) data[r.id] = r;
        this.write(table, data);
    }

    async removeMany(table: string, ids: string[]): Promise<void> {
        const data = this.read(table);
        for (const id of ids) delete data[id];
        this.write(table, data);
    }

    async getMeta(key: string): Promise<string | null> {
        return this.storage.getItem(`${PREFIX}meta:${key}`);
    }

    async setMeta(key: string, value: string | null): Promise<void> {
        if (value == null) this.storage.removeItem(`${PREFIX}meta:${key}`);
        else this.storage.setItem(`${PREFIX}meta:${key}`, value);
    }

    async clearAll(): Promise<void> {
        const keys: string[] = [];
        for (let i = 0; i < this.storage.length; i++) {
            const k = this.storage.key(i);
            if (k?.startsWith(PREFIX)) keys.push(k);
        }
        keys.forEach(k => this.storage.removeItem(k));
    }

    async readLegacy(): Promise<LegacyData | null> {
        return null; // v1 never persisted anything on web
    }

    async archiveLegacy(): Promise<void> {}
}
