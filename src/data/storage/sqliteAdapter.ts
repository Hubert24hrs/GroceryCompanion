import * as SQLite from 'expo-sqlite';
import { LegacyData, StorageAdapter, StoredRecord } from './types';

const DB_NAME = 'grocery_companion.db'; // same file as v1 so existing data is migrated in place

/** expo-sqlite persistence for iOS and Android. */
export class SQLiteAdapter implements StorageAdapter {
    private db: SQLite.SQLiteDatabase | null = null;

    private get conn(): SQLite.SQLiteDatabase {
        if (!this.db) throw new Error('Database not opened');
        return this.db;
    }

    async init(): Promise<void> {
        this.db = await SQLite.openDatabaseAsync(DB_NAME);
        await this.db.execAsync(`
            PRAGMA journal_mode = WAL;
            CREATE TABLE IF NOT EXISTS gc_records (
                tbl TEXT NOT NULL,
                id TEXT NOT NULL,
                data TEXT NOT NULL,
                PRIMARY KEY (tbl, id)
            );
            CREATE TABLE IF NOT EXISTS gc_meta (
                key TEXT PRIMARY KEY NOT NULL,
                value TEXT
            );
        `);
    }

    async loadTable(table: string): Promise<StoredRecord[]> {
        const rows = await this.conn.getAllAsync<{ data: string }>('SELECT data FROM gc_records WHERE tbl = ?', [table]);
        const out: StoredRecord[] = [];
        for (const row of rows) {
            try {
                out.push(JSON.parse(row.data));
            } catch {
                // A corrupt row must not take the whole table down.
            }
        }
        return out;
    }

    async putMany(table: string, records: StoredRecord[]): Promise<void> {
        if (!records.length) return;
        await this.conn.withTransactionAsync(async () => {
            for (const r of records) {
                await this.conn.runAsync('INSERT OR REPLACE INTO gc_records (tbl, id, data) VALUES (?, ?, ?)', [
                    table,
                    r.id,
                    JSON.stringify(r),
                ]);
            }
        });
    }

    async removeMany(table: string, ids: string[]): Promise<void> {
        if (!ids.length) return;
        await this.conn.withTransactionAsync(async () => {
            for (const id of ids) await this.conn.runAsync('DELETE FROM gc_records WHERE tbl = ? AND id = ?', [table, id]);
        });
    }

    async getMeta(key: string): Promise<string | null> {
        const row = await this.conn.getFirstAsync<{ value: string | null }>('SELECT value FROM gc_meta WHERE key = ?', [key]);
        return row?.value ?? null;
    }

    async setMeta(key: string, value: string | null): Promise<void> {
        if (value == null) await this.conn.runAsync('DELETE FROM gc_meta WHERE key = ?', [key]);
        else await this.conn.runAsync('INSERT OR REPLACE INTO gc_meta (key, value) VALUES (?, ?)', [key, value]);
    }

    async clearAll(): Promise<void> {
        await this.conn.execAsync('DELETE FROM gc_records; DELETE FROM gc_meta;');
    }

    private async tableExists(name: string): Promise<boolean> {
        const row = await this.conn.getFirstAsync<{ name: string }>(
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
            [name],
        );
        return !!row;
    }

    async readLegacy(): Promise<LegacyData | null> {
        if (!(await this.tableExists('lists'))) return null;
        const lists = await this.conn.getAllAsync<Record<string, unknown>>('SELECT * FROM lists');
        const items = (await this.tableExists('items'))
            ? await this.conn.getAllAsync<Record<string, unknown>>('SELECT * FROM items')
            : [];
        const recentItems = (await this.tableExists('recent_items'))
            ? await this.conn.getAllAsync<Record<string, unknown>>('SELECT * FROM recent_items')
            : [];
        return { lists, items, recentItems };
    }

    async archiveLegacy(): Promise<void> {
        // Rename rather than drop so v1 data stays recoverable.
        for (const name of ['lists', 'items', 'recent_items', 'sync_queue']) {
            if (await this.tableExists(name)) {
                await this.conn.execAsync(`ALTER TABLE ${name} RENAME TO legacy_v1_${name};`);
            }
        }
    }
}
