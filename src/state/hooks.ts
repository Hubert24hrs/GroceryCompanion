import { useSyncExternalStore } from 'react';
import { AllTables, getDb, LocalTable } from '../data/db';

/** Live rows of a table for the active household; re-renders on change. */
export function useTable<T extends LocalTable>(table: T): AllTables[T][] {
    const db = getDb();
    return useSyncExternalStore(
        cb => db.subscribe(cb),
        () => db.list(table),
    );
}

export function useRecord<T extends LocalTable>(table: T, id: string | undefined): AllTables[T] | undefined {
    const rows = useTable(table);
    return id ? rows.find(r => r.id === id) : undefined;
}
