import { PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import { SyncedTable } from '../domain/types';
import { PullCursor, RemoteApi, RemoteError } from './engine';
import { RemoteRow } from './mapping';

// Postgres/PostgREST codes that mean "this row will never succeed as-is".
const PERMANENT = new Set(['23502', '23503', '23505', '23514', '22P02', '22001', '42501', 'PGRST204', 'PGRST301']);

function toError(error: PostgrestError | Error): RemoteError {
    const code = 'code' in error ? (error as PostgrestError).code : undefined;
    const message = error.message || 'Sync failed';
    if (code && PERMANENT.has(code)) {
        const friendly = code === '42501' ? "You don't have permission to change this household's data." : message;
        return new RemoteError(friendly, false, code);
    }
    return new RemoteError(message, true, code);
}

// ISO timestamps contain ':' and '+' which PostgREST filter syntax needs quoted.
const quote = (v: string) => `"${v.replace(/"/g, '\\"')}"`;

export function createSupabaseRemote(client: SupabaseClient): RemoteApi {
    return {
        async upsert(table: SyncedTable, rows: RemoteRow[]) {
            const { error } = await client.from(table).upsert(rows, { onConflict: 'id', ignoreDuplicates: false });
            if (error) throw toError(error);
        },

        async pull(table: SyncedTable, after: PullCursor | null, limit: number) {
            let query = client.from(table).select('*').order('server_updated_at', { ascending: true }).order('id', { ascending: true }).limit(limit);
            if (after) {
                const ts = quote(after.serverUpdatedAt);
                query = query.or(`server_updated_at.gt.${ts},and(server_updated_at.eq.${ts},id.gt.${after.id})`);
            }
            const { data, error } = await query;
            if (error) throw toError(error);
            return (data ?? []) as (RemoteRow & { server_updated_at: string })[];
        },
    };
}
