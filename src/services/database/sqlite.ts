import * as SQLite from 'expo-sqlite';
import { ShoppingList, ListItem, RecentItem, SyncOperation, Category } from '../../types';
import { v4 as uuidv4 } from 'uuid';

let db: SQLite.SQLiteDatabase | null = null;

/**
 * Initialize the SQLite database and create tables
 */
export async function initDatabase(): Promise<void> {
    db = await SQLite.openDatabaseAsync('grocery_companion.db');

    await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    
    -- Shopping Lists table
    CREATE TABLE IF NOT EXISTS lists (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      owner_id TEXT,
      store_id TEXT,
      store_name TEXT,
      color TEXT DEFAULT '#4CAF50',
      is_archived INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      sync_version INTEGER DEFAULT 0,
      is_synced INTEGER DEFAULT 1
    );
    
    -- List Items table
    CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY,
      list_id TEXT NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      quantity REAL,
      unit TEXT,
      notes TEXT,
      is_checked INTEGER DEFAULT 0,
      is_in_pantry INTEGER DEFAULT 0,
      added_by TEXT,
      checked_by TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      sync_version INTEGER DEFAULT 0,
      is_synced INTEGER DEFAULT 1,
      FOREIGN KEY (list_id) REFERENCES lists(id) ON DELETE CASCADE
    );
    
    -- Recent items for autocomplete
    CREATE TABLE IF NOT EXISTS recent_items (
      name TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      usage_count INTEGER DEFAULT 1,
      last_used TEXT NOT NULL
    );
    
    -- Sync queue for offline operations
    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      operation TEXT NOT NULL,
      table_name TEXT NOT NULL,
      record_id TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL,
      retry_count INTEGER DEFAULT 0
    );
    
    -- Create indexes for faster queries
    CREATE INDEX IF NOT EXISTS idx_recent_items_usage ON recent_items(usage_count DESC);
  `);

    // Migrations for new columns
    try {
        await db.execAsync('ALTER TABLE lists ADD COLUMN budget REAL;');
    } catch (e) {
        // Column likely exists
    }

    try {
        await db.execAsync('ALTER TABLE items ADD COLUMN price REAL;');
    } catch (e) {
        // Column likely exists
    }
}

/**
 * Get the database instance
 */
export function getDatabase(): SQLite.SQLiteDatabase {
    if (!db) {
        throw new Error('Database not initialized. Call initDatabase() first.');
    }
    return db;
}

// ==================== Lists CRUD ====================

export async function createList(name: string, color: string = '#4CAF50', budget?: number): Promise<ShoppingList> {
    const database = getDatabase();
    const now = new Date().toISOString();
    const id = uuidv4();

    await database.runAsync(
        `INSERT INTO lists (id, name, color, budget, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
        [id, name, color, budget ?? null, now, now]
    );

    await addToSyncQueue('CREATE', 'lists', id, {
        id, name, color, budget, created_at: now, updated_at: now,
        owner_id: '', is_archived: 0, sync_version: 0, is_synced: 0
    });

    return {
        id,
        name,
        ownerId: '',
        color,
        isArchived: false,
        createdAt: new Date(now),
        updatedAt: new Date(now),
        syncVersion: 0,
        isSynced: true,
    };
}

export async function getAllLists(): Promise<ShoppingList[]> {
    const database = getDatabase();
    const rows = await database.getAllAsync<any>(
        `SELECT * FROM lists WHERE is_archived = 0 ORDER BY updated_at DESC`
    );

    return rows.map(row => ({
        id: row.id,
        name: row.name,
        ownerId: row.owner_id || '',
        storeId: row.store_id,
        storeName: row.store_name,
        color: row.color,
        budget: row.budget,
        isArchived: Boolean(row.is_archived),
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
        syncVersion: row.sync_version,
        isSynced: Boolean(row.is_synced),
    }));
}

export async function getListById(id: string): Promise<ShoppingList | null> {
    const database = getDatabase();
    const row = await database.getFirstAsync<any>(
        `SELECT * FROM lists WHERE id = ?`,
        [id]
    );

    if (!row) return null;

    return {
        id: row.id,
        name: row.name,
        ownerId: row.owner_id || '',
        storeId: row.store_id,
        storeName: row.store_name,
        color: row.color,
        budget: row.budget,
        isArchived: Boolean(row.is_archived),
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
        syncVersion: row.sync_version,
        isSynced: Boolean(row.is_synced),
    };
}

export async function updateList(id: string, updates: Partial<ShoppingList>): Promise<void> {
    const database = getDatabase();
    const now = new Date().toISOString();

    const setClauses: string[] = ['updated_at = ?'];
    const values: any[] = [now];

    if (updates.name !== undefined) {
        setClauses.push('name = ?');
        values.push(updates.name);
    }
    if (updates.color !== undefined) {
        setClauses.push('color = ?');
        values.push(updates.color);
    }
    if (updates.storeId !== undefined) {
        setClauses.push('store_id = ?');
        values.push(updates.storeId);
    }
    if (updates.storeName !== undefined) {
        setClauses.push('store_name = ?');
        values.push(updates.storeName);
    }
    if (updates.isArchived !== undefined) {
        setClauses.push('is_archived = ?');
        values.push(updates.isArchived ? 1 : 0);
    }
    if (updates.budget !== undefined) {
        setClauses.push('budget = ?');
        values.push(updates.budget);
    }

    values.push(id);

    await database.runAsync(
        `UPDATE lists SET ${setClauses.join(', ')} WHERE id = ?`,
        values
    );

    await addToSyncQueue('UPDATE', 'lists', id, updates);
}

export async function deleteList(id: string): Promise<void> {
    const database = getDatabase();
    await database.runAsync(`DELETE FROM lists WHERE id = ?`, [id]);
    await addToSyncQueue('DELETE', 'lists', id, {});
}

// ==================== Items CRUD ====================

export async function createItem(
    listId: string,
    name: string,
    category: Category,
    quantity?: number,
    unit?: string,
    price?: number,
    notes?: string
): Promise<ListItem> {
    const database = getDatabase();
    const now = new Date().toISOString();
    const id = uuidv4();

    await database.runAsync(
        `INSERT INTO items (id, list_id, name, category, quantity, unit, price, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, listId, name, category, quantity ?? null, unit ?? null, price ?? null, notes ?? null, now, now]
    );

    // Update recent items for autocomplete
    await updateRecentItem(name, category);

    await addToSyncQueue('CREATE', 'items', id, {
        id, list_id: listId, name, category, quantity, unit, price, notes,
        is_checked: 0, is_in_pantry: 0, created_at: now, updated_at: now,
        sync_version: 0, is_synced: 0
    });

    return {
        id,
        listId,
        name,
        category,
        quantity,
        unit,
        notes,
        isChecked: false,
        isInPantry: false,
        createdAt: new Date(now),
        updatedAt: new Date(now),
        syncVersion: 0,
        isSynced: true,
    };
}

export async function getItemsByListId(listId: string): Promise<ListItem[]> {
    const database = getDatabase();
    const rows = await database.getAllAsync<any>(
        `SELECT * FROM items WHERE list_id = ? ORDER BY is_checked ASC, category ASC, name ASC`,
        [listId]
    );

    return rows.map(row => ({
        id: row.id,
        listId: row.list_id,
        name: row.name,
        category: row.category as Category,
        quantity: row.quantity,
        unit: row.unit,
        price: row.price,
        notes: row.notes,
        isChecked: Boolean(row.is_checked),
        isInPantry: Boolean(row.is_in_pantry),
        addedBy: row.added_by,
        checkedBy: row.checked_by,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
        syncVersion: row.sync_version,
        isSynced: Boolean(row.is_synced),
    }));
}

export async function getExpenses(startDate?: Date, endDate?: Date): Promise<ListItem[]> {
    const database = getDatabase();
    let query = `SELECT * FROM items WHERE is_in_pantry = 1 AND price IS NOT NULL`;
    const params: any[] = [];

    if (startDate) {
        query += ` AND updated_at >= ?`;
        params.push(startDate.toISOString());
    }
    if (endDate) {
        query += ` AND updated_at <= ?`;
        params.push(endDate.toISOString());
    }

    query += ` ORDER BY updated_at DESC`;

    const rows = await database.getAllAsync<any>(query, params);

    return rows.map(row => ({
        id: row.id,
        listId: row.list_id,
        name: row.name,
        category: row.category as Category,
        quantity: row.quantity,
        unit: row.unit,
        price: row.price,
        notes: row.notes,
        isChecked: Boolean(row.is_checked),
        isInPantry: Boolean(row.is_in_pantry),
        addedBy: row.added_by,
        checkedBy: row.checked_by,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
        syncVersion: row.sync_version,
        isSynced: Boolean(row.is_synced),
    }));
}

export async function updateItem(id: string, updates: Partial<ListItem>): Promise<void> {
    const database = getDatabase();
    const now = new Date().toISOString();

    const setClauses: string[] = ['updated_at = ?'];
    const values: any[] = [now];

    if (updates.name !== undefined) {
        setClauses.push('name = ?');
        values.push(updates.name);
    }
    if (updates.category !== undefined) {
        setClauses.push('category = ?');
        values.push(updates.category);
    }
    if (updates.quantity !== undefined) {
        setClauses.push('quantity = ?');
        values.push(updates.quantity);
    }
    if (updates.unit !== undefined) {
        setClauses.push('unit = ?');
        values.push(updates.unit);
    }
    if (updates.price !== undefined) {
        setClauses.push('price = ?');
        values.push(updates.price);
    }
    if (updates.notes !== undefined) {
        setClauses.push('notes = ?');
        values.push(updates.notes);
    }
    if (updates.isChecked !== undefined) {
        setClauses.push('is_checked = ?');
        values.push(updates.isChecked ? 1 : 0);
    }
    if (updates.isInPantry !== undefined) {
        setClauses.push('is_in_pantry = ?');
        values.push(updates.isInPantry ? 1 : 0);
    }

    values.push(id);

    await database.runAsync(
        `UPDATE items SET ${setClauses.join(', ')} WHERE id = ?`,
        values
    );

    await addToSyncQueue('UPDATE', 'items', id, updates);
}

export async function toggleItemChecked(id: string): Promise<boolean> {
    const database = getDatabase();
    const now = new Date().toISOString();

    // Get current state
    const item = await database.getFirstAsync<any>(`SELECT is_checked FROM items WHERE id = ?`, [id]);
    if (!item) throw new Error('Item not found');

    const newState = item.is_checked ? 0 : 1;

    await database.runAsync(
        `UPDATE items SET is_checked = ?, updated_at = ? WHERE id = ?`,
        [newState, now, id]
    );

    await addToSyncQueue('UPDATE', 'items', id, { isChecked: Boolean(newState) });
    return Boolean(newState);
}

export async function deleteItem(id: string): Promise<void> {
    const database = getDatabase();
    await database.runAsync(`DELETE FROM items WHERE id = ?`, [id]);
    await addToSyncQueue('DELETE', 'items', id, {});
}

export async function deleteCheckedItems(listId: string): Promise<void> {
    const database = getDatabase();

    // Get IDs of items to be deleted for sync queue
    const itemsToDelete = await database.getAllAsync<any>(
        `SELECT id FROM items WHERE list_id = ? AND is_checked = 1`,
        [listId]
    );

    await database.runAsync(`DELETE FROM items WHERE list_id = ? AND is_checked = 1`, [listId]);

    // Queue delete operations
    for (const item of itemsToDelete) {
        await addToSyncQueue('DELETE', 'items', item.id, {});
    }
}

export async function moveCheckedToPantry(listId: string): Promise<void> {
    const database = getDatabase();
    const now = new Date().toISOString();

    // Get IDs for sync queue
    const itemsToMove = await database.getAllAsync<any>(
        `SELECT id FROM items WHERE list_id = ? AND is_checked = 1`,
        [listId]
    );

    // Update local DB: is_in_pantry = 1, is_checked = 0
    await database.runAsync(
        `UPDATE items SET is_in_pantry = 1, is_checked = 0, updated_at = ? 
         WHERE list_id = ? AND is_checked = 1`,
        [now, listId]
    );

    // Queue updates
    for (const item of itemsToMove) {
        await addToSyncQueue('UPDATE', 'items', item.id, {
            isInPantry: true,
            isChecked: false,
            updatedAt: now
        });
    }
}

// ==================== Recent Items ====================

async function updateRecentItem(name: string, category: Category): Promise<void> {
    const database = getDatabase();
    const now = new Date().toISOString();
    const normalizedName = name.toLowerCase().trim();

    // Try to update existing record, or insert new one
    const existing = await database.getFirstAsync<any>(
        `SELECT * FROM recent_items WHERE name = ?`,
        [normalizedName]
    );

    if (existing) {
        await database.runAsync(
            `UPDATE recent_items SET usage_count = usage_count + 1, last_used = ?, category = ? WHERE name = ?`,
            [now, category, normalizedName]
        );
    } else {
        await database.runAsync(
            `INSERT INTO recent_items (name, category, usage_count, last_used) VALUES (?, ?, 1, ?)`,
            [normalizedName, category, now]
        );
    }
}

export async function getRecentItems(limit: number = 20): Promise<RecentItem[]> {
    const database = getDatabase();
    const rows = await database.getAllAsync<any>(
        `SELECT * FROM recent_items ORDER BY usage_count DESC, last_used DESC LIMIT ?`,
        [limit]
    );

    return rows.map(row => ({
        name: row.name,
        category: row.category as Category,
        usageCount: row.usage_count,
        lastUsed: new Date(row.last_used),
    }));
}

export async function searchRecentItems(query: string, limit: number = 10): Promise<RecentItem[]> {
    const database = getDatabase();
    const rows = await database.getAllAsync<any>(
        `SELECT * FROM recent_items WHERE name LIKE ? ORDER BY usage_count DESC LIMIT ?`,
        [`%${query.toLowerCase()}%`, limit]
    );

    return rows.map(row => ({
        name: row.name,
        category: row.category as Category,
        usageCount: row.usage_count,
        lastUsed: new Date(row.last_used),
    }));
}

// ==================== Sync Queue ====================

export async function addToSyncQueue(
    operation: 'CREATE' | 'UPDATE' | 'DELETE',
    tableName: string,
    recordId: string,
    payload: object
): Promise<void> {
    const database = getDatabase();
    const now = new Date().toISOString();

    await database.runAsync(
        `INSERT INTO sync_queue (operation, table_name, record_id, payload, created_at)
     VALUES (?, ?, ?, ?, ?)`,
        [operation, tableName, recordId, JSON.stringify(payload), now]
    );
}

export async function getPendingSyncOperations(): Promise<SyncOperation[]> {
    const database = getDatabase();
    const rows = await database.getAllAsync<any>(
        `SELECT * FROM sync_queue ORDER BY created_at ASC`
    );

    return rows.map(row => ({
        id: row.id,
        operation: row.operation,
        tableName: row.table_name,
        recordId: row.record_id,
        payload: row.payload,
        createdAt: new Date(row.created_at),
        retryCount: row.retry_count,
    }));
}

export async function removeSyncOperation(id: number): Promise<void> {
    const database = getDatabase();
    await database.runAsync(`DELETE FROM sync_queue WHERE id = ?`, [id]);
}

export async function incrementSyncRetry(id: number): Promise<void> {
    const database = getDatabase();
    await database.runAsync(
        `UPDATE sync_queue SET retry_count = retry_count + 1 WHERE id = ?`,
        [id]
    );
}

// ==================== Sync Helpers ====================

export async function upsertListFromSync(list: ShoppingList): Promise<void> {
    const database = getDatabase();

    const existing = await database.getFirstAsync<any>(
        'SELECT id FROM lists WHERE id = ?',
        [list.id]
    );

    const isSynced = list.isSynced ? 1 : 0;
    const isArchived = list.isArchived ? 1 : 0;

    if (existing) {
        await database.runAsync(
            `UPDATE lists SET 
       name = ?, owner_id = ?, store_id = ?, store_name = ?, color = ?, 
       is_archived = ?, created_at = ?, updated_at = ?, sync_version = ?, is_synced = ?
       WHERE id = ?`,
            [
                list.name, list.ownerId, list.storeId ?? null, list.storeName ?? null, list.color,
                isArchived, list.createdAt.toISOString(), list.updatedAt.toISOString(),
                list.syncVersion, isSynced, list.id
            ]
        );
    } else {
        await database.runAsync(
            `INSERT INTO lists (id, name, owner_id, store_id, store_name, color, is_archived, created_at, updated_at, sync_version, is_synced)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                list.id, list.name, list.ownerId, list.storeId ?? null, list.storeName ?? null, list.color,
                isArchived, list.createdAt.toISOString(), list.updatedAt.toISOString(),
                list.syncVersion, isSynced
            ]
        );
    }
}

export async function upsertItemFromSync(item: ListItem): Promise<void> {
    const database = getDatabase();

    const existing = await database.getFirstAsync<any>(
        'SELECT id FROM items WHERE id = ?',
        [item.id]
    );

    const isSynced = item.isSynced ? 1 : 0;
    const isChecked = item.isChecked ? 1 : 0;
    const isInPantry = item.isInPantry ? 1 : 0;

    if (existing) {
        await database.runAsync(
            `UPDATE items SET 
       list_id = ?, name = ?, category = ?, quantity = ?, unit = ?, notes = ?, 
       is_checked = ?, is_in_pantry = ?, added_by = ?, checked_by = ?,
       created_at = ?, updated_at = ?, sync_version = ?, is_synced = ?
       WHERE id = ?`,
            [
                item.listId, item.name, item.category, item.quantity ?? null, item.unit ?? null, item.notes ?? null,
                isChecked, isInPantry, item.addedBy ?? null, item.checkedBy ?? null,
                item.createdAt.toISOString(), item.updatedAt.toISOString(),
                item.syncVersion, isSynced, item.id
            ]
        );
    } else {
        await database.runAsync(
            `INSERT INTO items (
        id, list_id, name, category, quantity, unit, notes, 
        is_checked, is_in_pantry, added_by, checked_by,
        created_at, updated_at, sync_version, is_synced
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                item.id, item.listId, item.name, item.category, item.quantity ?? null, item.unit ?? null, item.notes ?? null,
                isChecked, isInPantry, item.addedBy ?? null, item.checkedBy ?? null,
                item.createdAt.toISOString(), item.updatedAt.toISOString(),
                item.syncVersion, isSynced
            ]
        );
    }
}
