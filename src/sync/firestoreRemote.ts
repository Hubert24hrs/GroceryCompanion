import {
    collection,
    doc,
    documentId,
    Firestore,
    FirestoreError,
    getDocsFromServer,
    limit,
    orderBy,
    query,
    runTransaction,
    serverTimestamp,
    startAfter,
    Timestamp,
} from 'firebase/firestore';
import { SyncedTable } from '../domain/types';
import { PullCursor, RemoteApi, RemoteError } from './engine';
import { RemoteRow } from './mapping';

// Firestore codes that mean "this write will never succeed as-is".
const PERMANENT = new Set(['permission-denied', 'invalid-argument', 'failed-precondition', 'not-found', 'already-exists', 'out-of-range']);

function toError(e: unknown): RemoteError {
    const code = (e as FirestoreError | undefined)?.code;
    const message = e instanceof Error && e.message ? e.message : 'Sync failed';
    if (code && PERMANENT.has(code)) {
        const friendly = code === 'permission-denied' ? "You don't have permission to change this household's data." : message;
        return new RemoteError(friendly, false, code);
    }
    return new RemoteError(message, true, code);
}

/** Rows per transaction (Firestore allows 500 writes; smaller keeps retries cheap). */
const CHUNK = 100;

const tableRef = (db: Firestore, householdId: string, table: SyncedTable) => collection(db, 'households', householdId, table);

/**
 * `updated_at` travels as a Firestore Timestamp so the security rules can
 * compare versions; every other *_at field stays an ISO string.
 */
function toDoc(row: RemoteRow): Record<string, unknown> {
    return { ...row, updated_at: Timestamp.fromDate(new Date(row.updated_at as string)), server_updated_at: serverTimestamp() };
}

function fromDoc(data: Record<string, unknown>): RemoteRow {
    const row: RemoteRow = {};
    for (const [key, value] of Object.entries(data)) {
        if (key === 'server_updated_at') continue;
        row[key] = value instanceof Timestamp ? value.toDate().toISOString() : value;
    }
    return row;
}

// The engine stores cursors as opaque strings. Keep full nanosecond precision
// (ISO strings would round to milliseconds) and the household they belong to,
// so switching households starts that household's pull from scratch.
function encodeCursor(householdId: string, ts: Timestamp): string {
    return `${householdId}|${ts.seconds}|${ts.nanoseconds}`;
}

function decodeCursor(householdId: string, cursor: PullCursor | null): Timestamp | null {
    const [hid, seconds, nanos] = cursor?.serverUpdatedAt.split('|') ?? [];
    if (hid !== householdId || seconds == null || nanos == null) return null;
    return new Timestamp(Number(seconds), Number(nanos));
}

/** Sync rows live at households/{householdId}/{table}/{id}. */
export function createFirestoreRemote(db: Firestore, activeHouseholdId: () => string): RemoteApi {
    return {
        async upsert(table: SyncedTable, rows: RemoteRow[]) {
            for (let i = 0; i < rows.length; i += CHUNK) {
                const chunk = rows.slice(i, i + CHUNK);
                try {
                    await runTransaction(db, async tx => {
                        const refs = chunk.map(r => doc(tableRef(db, r.household_id as string, table), r.id as string));
                        const current = await Promise.all(refs.map(ref => tx.get(ref)));
                        chunk.forEach((row, j) => {
                            // Last writer wins: leave a newer server copy alone; the pull brings it down.
                            const stored = current[j].get('updated_at') as Timestamp | undefined;
                            if (stored && stored.toMillis() > Date.parse(row.updated_at as string)) return;
                            tx.set(refs[j], toDoc(row));
                        });
                    });
                } catch (e) {
                    throw toError(e);
                }
            }
        },

        async pull(table: SyncedTable, after: PullCursor | null, pageSize: number) {
            const householdId = activeHouseholdId();
            const since = decodeCursor(householdId, after);
            const order = [orderBy('server_updated_at'), orderBy(documentId())];
            const q =
                since && after
                    ? query(tableRef(db, householdId, table), ...order, startAfter(since, after.id), limit(pageSize))
                    : query(tableRef(db, householdId, table), ...order, limit(pageSize));
            try {
                const snap = await getDocsFromServer(q);
                return snap.docs.map(d => ({
                    ...fromDoc(d.data()),
                    server_updated_at: encodeCursor(householdId, d.get('server_updated_at') as Timestamp),
                }));
            } catch (e) {
                throw toError(e);
            }
        },
    };
}
