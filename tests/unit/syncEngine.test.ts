import { SyncEngine } from '../../src/services/sync/syncEngine';

// Mock dependencies
jest.mock('../../src/services/sync/supabase', () => ({
    supabase: {
        from: jest.fn(),
    },
}));

jest.mock('../../src/services/database/sqlite', () => ({
    getPendingSyncOperations: jest.fn(),
    removeSyncOperation: jest.fn(),
    incrementSyncRetry: jest.fn(),
    getListById: jest.fn(),
    getItemsByListId: jest.fn(),
    upsertListFromSync: jest.fn(),
    upsertItemFromSync: jest.fn(),
}));

describe('SyncEngine', () => {
    let syncEngine: SyncEngine;

    beforeEach(() => {
        syncEngine = new SyncEngine();
    });

    describe('cleanPayloadForRemote', () => {
        it('converts camelCase to snake_case and removes is_synced', () => {
            const input = {
                id: '123',
                firstName: 'John',
                isSynced: true,
                syncVersion: 1,
            };

            const expected = {
                id: '123',
                first_name: 'John',
                sync_version: 1,
            };

            const result = syncEngine.cleanPayloadForRemote(input);
            expect(result).toEqual(expected);
        });

        it('handles mixed casing and keeps sync_version', () => {
            const input = {
                id: '123',
                created_at: '2023-01-01', // already snake
                updatedAt: '2023-01-02', // camel
                is_synced: true, // snake
                syncVersion: 2, // camel
            };

            const expected = {
                id: '123',
                created_at: '2023-01-01',
                updated_at: '2023-01-02',
                sync_version: 2,
            };

            const result = syncEngine.cleanPayloadForRemote(input);
            expect(result).toEqual(expected);
        });
    });
});
