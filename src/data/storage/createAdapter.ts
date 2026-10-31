import { SQLiteAdapter } from './sqliteAdapter';
import { StorageAdapter } from './types';

export function createAdapter(): StorageAdapter {
    return new SQLiteAdapter();
}
