import { supabase } from './supabase';
import * as db from '../database/sqlite';
import { ShoppingList, ListItem } from '../../types';
import { toSnakeCase } from '../../utils/formatters';

const SYNC_BATCH_SIZE = 50;
const MAX_RETRIES = 5;

type TableName = 'lists' | 'items';

export class SyncEngine {
    private isSyncing = false;
    private lastSyncTime: Record<TableName, Date> = {
        lists: new Date(0),
        items: new Date(0),
    };

    /**
     * Process pending local operations and push them to Supabase
     */
    async processQueue(): Promise<void> {
        if (this.isSyncing) return;
        this.isSyncing = true;

        try {
            const pendingOps = await db.getPendingSyncOperations();

            for (const op of pendingOps) {
                if (op.retryCount >= MAX_RETRIES) {
                    console.warn(`Skipping operation ${op.id} after max retries`);
                    // Optionally delete or move to dead-letter queue
                    continue;
                }

                try {
                    await this.executeOperation(op);
                    await db.removeSyncOperation(op.id);
                } catch (error) {
                    console.error(`Failed to execute operation ${op.id}:`, error);
                    await db.incrementSyncRetry(op.id);
                }
            }
        } finally {
            this.isSyncing = false;
        }
    }

    /**
     * Execute a single sync operation against Supabase
     */
    private async executeOperation(op: any): Promise<void> {
        const payload = JSON.parse(op.payload);
        const { table_name, operation, record_id } = op;
        const tableName = op.tableName as TableName; // 'lists' or 'items'

        // Clean payload for Supabase (remove local-only fields)
        const cleanPayload = this.cleanPayloadForRemote(payload);

        if (op.operation === 'CREATE') {
            const { error } = await supabase
                .from(tableName)
                .insert(cleanPayload);
            if (error) throw error;
        }
        else if (op.operation === 'UPDATE') {
            const { error } = await supabase
                .from(tableName)
                .update(cleanPayload)
                .eq('id', op.recordId);
            if (error) throw error;
        }
        else if (op.operation === 'DELETE') {
            const { error } = await supabase
                .from(tableName)
                .delete()
                .eq('id', op.recordId);
            if (error) throw error;
        }
    }

    /**
     * Remove local-only fields before sending to server
     */
    public cleanPayloadForRemote(data: any): any {
        // First convert to snake_case to normalize keys
        const snakeData = toSnakeCase(data);

        const {
            is_synced,
            // sync_version is kept as it exists on server
            ...rest
        } = snakeData;
        return rest;
    }

    /**
     * Pull latest changes from Supabase
     */
    async pullRemoteChanges(): Promise<void> {
        await this.pullTable('lists');
        await this.pullTable('items');
    }

    private async pullTable(table: TableName): Promise<void> {
        const lastSync = this.lastSyncTime[table];

        // Fetch changes since last sync
        const { data, error } = await supabase
            .from(table)
            .select('*')
            .gt('updated_at', lastSync.toISOString())
            .limit(SYNC_BATCH_SIZE);

        if (error) throw error;
        if (!data || data.length === 0) return;

        // Apply changes locally
        for (const remoteRecord of data) {
            if (table === 'lists') {
                await this.mergeList(remoteRecord as any);
            } else {
                await this.mergeItem(remoteRecord as any);
            }
        }

        // Update last sync time (use the latest updated_at from received data)
        const latestUpdate = new Date(Math.max(...data.map(r => new Date(r.updated_at).getTime())));
        this.lastSyncTime[table] = latestUpdate;
    }

    private async mergeList(remote: any): Promise<void> {
        const local = await db.getListById(remote.id);
        const remoteList: ShoppingList = {
            ...remote,
            isSynced: true,
            syncVersion: remote.sync_version ?? 0,
            createdAt: new Date(remote.created_at),
            updatedAt: new Date(remote.updated_at),
            isArchived: Boolean(remote.is_archived),
            ownerId: remote.owner_id || '',
        };

        if (!local) {
            // It's tricky to insert directly with `createList` because it generates a new ID.
            // We need a direct insert method in `sqlite.ts` that accepts an ID, 
            // OR we hack it. Ideally, `sqlite.ts` should have `upsertList`.
            // For now, I'll rely on the schema allowing inserts.
            // BUT `db.createList` generates a UUID. I need a lower-level insert.
            // I'll add `importList` to `sqlite.ts` later or use raw SQL here if I could.
            // Actually `db.createList` is for user actions.
            // I will assume I can add a method to `sqlite.ts` called `upsertListFromSync`.
            await db.upsertListFromSync(remoteList);
        } else {
            // Conflict resolution: Remote wins if newer
            if (remoteList.updatedAt > local.updatedAt) {
                await db.upsertListFromSync(remoteList);
            }
        }
    }

    private async mergeItem(remote: any): Promise<void> {
        const localItems = await db.getItemsByListId(remote.list_id);
        const local = localItems.find(i => i.id === remote.id);

        const remoteItem: ListItem = {
            ...remote,
            isSynced: true,
            syncVersion: remote.sync_version ?? 0,
            createdAt: new Date(remote.created_at),
            updatedAt: new Date(remote.updated_at),
            isChecked: Boolean(remote.is_checked),
            isInPantry: Boolean(remote.is_in_pantry),
            category: remote.category as any, // Cast loose string to Category type
        };

        if (!local || remoteItem.updatedAt > local.updatedAt) {
            await db.upsertItemFromSync(remoteItem);
        }
    }
}

export const syncEngine = new SyncEngine();
