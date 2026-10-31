import { addItem, addLowStockToList, addPantryItem, createList, finishTrip, toggleItem } from '../repo';
import { LocalDatabase, setDb } from '../db';
import { importLegacy } from '../legacy';
import { MemoryAdapter } from '../storage/memoryAdapter';
import { RemoteApi, SyncEngine } from '../../sync/engine';
import { RemoteRow } from '../../sync/mapping';
import { hostOf } from '../../domain/validation';

async function freshDb() {
    const db = new LocalDatabase(new MemoryAdapter());
    await db.open();
    db.setHousehold('h1', 'u1');
    setDb(db);
    return db;
}

describe('pantry restock and locations', () => {
    test('restocking from a finished trip and adding by hand use the same location', async () => {
        const db = await freshDb();
        const list = createList({ name: 'Weekly', color: '#000' });
        const bananas = addItem(list.id, { name: 'bananas' }).item;
        toggleItem(bananas.id);
        await finishTrip(list.id, { restockPantry: true });
        const restocked = db.list('pantry_items').find(p => p.name === 'Bananas');
        const byHand = addPantryItem({ name: 'Spinach' });
        expect(restocked?.location).toBe('fridge');
        expect(byHand.location).toBe('fridge');
    });

    test('low-stock restock matches products by item key, not exact text', async () => {
        const db = await freshDb();
        const list = createList({ name: 'Weekly', color: '#000' });
        addItem(list.id, { name: 'Banana' });
        addPantryItem({ name: 'Bananas', quantity: 0 });
        addPantryItem({ name: 'Rice', quantity: 0 });
        const added = await addLowStockToList(list.id);
        expect(added).toBe(1); // only rice; "Bananas" is already on the list as "Banana"
        expect(db.list('items').filter(i => i.listId === list.id).map(i => i.name).sort()).toEqual(['Banana', 'Rice']);
    });
});

describe('v1 migration', () => {
    test('pantry location, recent-item keys and meal dates are normalised', async () => {
        const db = await freshDb();
        await importLegacy(
            db,
            {
                lists: [{ id: 'l1', name: 'Old list' }],
                items: [{ id: 'i1', list_id: 'l1', name: 'Apples', category: 'produce', is_in_pantry: 1 }],
                recentItems: [{ name: 'Bananas', usage_count: 3 }],
            },
            { meals: [{ date: '2025-01-02T18:00:00.000Z', type: 'dinner', recipeId: '1' }, { date: 'garbage', type: 'lunch', recipeId: '1' }] },
            new Map([['1', 'recipe-1']]),
        );
        expect(db.list('pantry_items')[0].location).toBe('fridge');
        expect(db.get('recent_items', 'banana')?.useCount).toBe(3);
        expect(db.list('meal_plan_entries').map(m => m.date)).toEqual(['2025-01-02']);
    });
});

describe('hostOf', () => {
    test('reads the host without the URL class', () => {
        expect(hostOf('https://www.BBCGoodFood.com/recipes/x?y=1')).toBe('bbcgoodfood.com');
        expect(hostOf('https://user@site.org:8080/a')).toBe('site.org');
        expect(hostOf('not a url')).toBeNull();
    });
});

describe('sync engine', () => {
    /** In-memory stand-in for Firestore with the same last-writer-wins rule. */
    function fakeRemote() {
        const rows = new Map<string, RemoteRow & { server_updated_at: string }>();
        let clock = 0;
        const remote: RemoteApi = {
            async upsert(_table, batch) {
                for (const r of batch) {
                    const stored = rows.get(r.id as string);
                    if (stored && (stored.updated_at as string) > (r.updated_at as string)) continue;
                    rows.set(r.id as string, { ...r, server_updated_at: String(++clock).padStart(8, '0') });
                }
            },
            async pull(table, after, limit) {
                return [...rows.values()]
                    .filter(r => (table === 'lists' ? !('list_id' in r) : false))
                    .filter(r => !after || r.server_updated_at > after.serverUpdatedAt)
                    .sort((a, b) => a.server_updated_at.localeCompare(b.server_updated_at))
                    .slice(0, limit);
            },
        };
        return { remote, rows };
    }

    test('pushes queued changes and clears the outbox', async () => {
        const db = await freshDb();
        const { remote, rows } = fakeRemote();
        createList({ name: 'Weekly', color: '#000' });
        const engine = new SyncEngine(db, remote);
        await engine.syncNow();
        expect([...rows.values()].map(r => r.name)).toEqual(['Weekly']);
        expect(db.pendingOutbox()).toHaveLength(0);
        expect(engine.state.status).toBe('idle');
    });

    test('a device with no local rows ignores a saved pull position and re-downloads', async () => {
        const db = await freshDb();
        const { remote, rows } = fakeRemote();
        const list = createList({ name: 'Weekly', color: '#000' });
        const engine = new SyncEngine(db, remote);
        await engine.syncNow();
        await engine.syncNow(); // stores a pull position past the only row
        expect(rows.size).toBe(1);

        await db.removeHouseholdData('h1'); // what a wipe leaves behind: no rows, position kept
        expect(db.list('lists')).toHaveLength(0);

        await engine.syncNow();
        expect(db.get('lists', list.id)?.name).toBe('Weekly');
    });

    test('a newer server edit wins over an older unsynced local edit', async () => {
        const db = await freshDb();
        const { remote, rows } = fakeRemote();
        const list = createList({ name: 'Weekly', color: '#000' });
        const engine = new SyncEngine(db, remote);
        await engine.syncNow();

        db.update('lists', list.id, { name: 'Local rename' });
        const local = db.get('lists', list.id)!;
        // Another device renamed it later.
        rows.set(list.id, { ...rows.get(list.id)!, name: 'Remote rename', updated_at: new Date(Date.parse(local.updatedAt) + 60_000).toISOString(), server_updated_at: '99999999' });

        await engine.syncNow();
        expect(db.get('lists', list.id)?.name).toBe('Remote rename');
        expect(db.pendingOutbox()).toHaveLength(0);
    });
});
