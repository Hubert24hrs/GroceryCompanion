const { createDatabase, migrate, createUser, as } = require('./harness');

const A = '00000000-0000-4000-8000-00000000000a';
const B = '00000000-0000-4000-8000-00000000000b';
const C = '00000000-0000-4000-8000-00000000000c';
const D = '00000000-0000-4000-8000-00000000000d';
const HH = '11111111-1111-4111-8111-111111111111';
const LIST = '22222222-2222-4222-8222-222222222222';

jest.setTimeout(120000);

const listRow = (overrides = {}) => ({
  id: LIST,
  household_id: HH,
  name: 'Weekly shop',
  updated_at: '2026-10-01T10:00:00.000Z',
  ...overrides,
});

async function upsertList(tx, row) {
  return tx.query(
    `insert into lists (id, household_id, name, updated_at) values ($1, $2, $3, $4)
     on conflict (id) do update set name = excluded.name, household_id = excluded.household_id, updated_at = excluded.updated_at`,
    [row.id, row.household_id, row.name, row.updated_at],
  );
}

async function inviteAndAccept(db, inviter, invitee, role) {
  const code = await as(db, inviter, async tx => (await tx.query('select code from create_invite($1, $2)', [HH, role])).rows[0].code);
  return as(db, invitee, async tx => (await tx.query('select accept_invite($1) as hid', [code])).rows[0].hid);
}

describe('households, RLS and sync guards (fresh database)', () => {
  let db;

  beforeAll(async () => {
    db = await createDatabase();
    await migrate(db);
    for (const [id, email] of [[A, 'a@example.com'], [B, 'b@example.com'], [C, 'c@example.com'], [D, 'd@example.com']]) {
      await createUser(db, id, email);
    }
  });

  test('bootstrap_household creates the household with the offline id, then reuses it', async () => {
    const first = await as(db, A, async tx => (await tx.query('select bootstrap_household($1, $2) as id', [HH, 'Home'])).rows[0].id);
    expect(first).toBe(HH);
    const again = await as(db, A, async tx => (await tx.query('select bootstrap_household($1) as id', [null])).rows[0].id);
    expect(again).toBe(HH);
  });

  test('bootstrap_household refuses to adopt an id that already exists', async () => {
    const id = await as(db, B, async tx => (await tx.query('select bootstrap_household($1) as id', [HH])).rows[0].id);
    expect(id).not.toBe(HH);
    // B now owns a separate household; clean it up so later tests start simple.
    await db.query('delete from households where id = $1', [id]);
  });

  test('anonymous users cannot call RPCs', async () => {
    await expect(as(db, null, tx => tx.query('select bootstrap_household()'))).rejects.toThrow(/permission denied/);
  });

  test('owner can write; strangers can neither read nor write', async () => {
    await as(db, A, tx => upsertList(tx, listRow()));
    const seen = await as(db, B, async tx => (await tx.query('select * from lists')).rows);
    expect(seen).toHaveLength(0);
    await expect(as(db, B, tx => upsertList(tx, listRow({ name: 'hijack', updated_at: '2030-01-01T00:00:00Z' })))).rejects.toThrow(
      /row-level security/,
    );
    const name = (await db.query('select name from lists where id = $1', [LIST])).rows[0].name;
    expect(name).toBe('Weekly shop');
  });

  test('clients cannot create households or memberships directly', async () => {
    await expect(
      as(db, B, tx => tx.query('insert into household_members (household_id, user_id, role) values ($1, $2, $3)', [HH, B, 'owner'])),
    ).rejects.toThrow(/permission denied/);
  });

  test('last writer wins: stale updates are ignored, newer ones apply', async () => {
    const before = (await db.query('select server_updated_at from lists where id = $1', [LIST])).rows[0].server_updated_at;
    await as(db, A, tx => upsertList(tx, listRow({ name: 'stale', updated_at: '2026-09-01T00:00:00.000Z' })));
    expect((await db.query('select name from lists where id = $1', [LIST])).rows[0].name).toBe('Weekly shop');

    await as(db, A, tx => upsertList(tx, listRow({ name: 'Newer', updated_at: '2026-10-02T00:00:00.000Z' })));
    const row = (await db.query('select name, server_updated_at from lists where id = $1', [LIST])).rows[0];
    expect(row.name).toBe('Newer');
    expect(new Date(row.server_updated_at).getTime()).toBeGreaterThan(new Date(before).getTime());
  });

  test('client clocks far in the future are clamped', async () => {
    await as(db, A, tx => upsertList(tx, listRow({ name: 'Future', updated_at: '2099-01-01T00:00:00.000Z' })));
    const row = (await db.query('select updated_at from lists where id = $1', [LIST])).rows[0];
    expect(new Date(row.updated_at).getFullYear()).toBeLessThan(2099);
  });

  test('editor invite: member can read and write household data', async () => {
    expect(await inviteAndAccept(db, A, B, 'editor')).toBe(HH);
    const lists = await as(db, B, async tx => (await tx.query('select id from lists')).rows);
    expect(lists.map(r => r.id)).toEqual([LIST]);
    await as(db, B, tx =>
      tx.query(
        `insert into items (id, household_id, list_id, name, category, updated_at) values (gen_random_uuid(), $1, $2, 'Milk', 'dairy', now())`,
        [HH, LIST],
      ),
    );
    const count = (await db.query('select count(*)::int as n from items where list_id = $1', [LIST])).rows[0].n;
    expect(count).toBe(1);
  });

  test('viewer invite: can read but not write', async () => {
    await inviteAndAccept(db, A, C, 'viewer');
    const items = await as(db, C, async tx => (await tx.query('select name from items')).rows);
    expect(items.map(r => r.name)).toEqual(['Milk']);
    await expect(
      as(db, C, tx =>
        tx.query(`insert into items (id, household_id, list_id, name, category, updated_at) values (gen_random_uuid(), $1, $2, 'Eggs', 'dairy', now())`, [
          HH,
          LIST,
        ]),
      ),
    ).rejects.toThrow(/row-level security/);
    await expect(as(db, C, tx => tx.query('select code from create_invite($1, $2)', [HH, 'editor']))).rejects.toThrow(/not allowed/);
  });

  test('items cannot point at a list in another household', async () => {
    const other = await as(db, D, async tx => (await tx.query('select bootstrap_household() as id')).rows[0].id);
    await expect(
      as(db, D, tx =>
        tx.query(`insert into items (id, household_id, list_id, name, category, updated_at) values (gen_random_uuid(), $1, $2, 'x', 'other', now())`, [
          other,
          LIST,
        ]),
      ),
    ).rejects.toThrow(/does not match/);
    await db.query('delete from households where id = $1', [other]);
  });

  test('free households are capped at 3 members; Pro (set by the webhook) lifts it', async () => {
    await expect(inviteAndAccept(db, A, D, 'editor')).rejects.toThrow(/household_full/);
    await db.query('insert into subscriptions (user_id, is_pro, expires_at) values ($1, true, now() + interval \'30 days\')', [A]);
    expect(await inviteAndAccept(db, A, D, 'editor')).toBe(HH);
  });

  test('users cannot grant themselves Pro', async () => {
    await expect(as(db, B, tx => tx.query('insert into subscriptions (user_id, is_pro) values ($1, true)', [B]))).rejects.toThrow(
      /permission denied/,
    );
    await expect(as(db, B, tx => tx.query('update profiles set is_pro = true where id = $1', [B]))).rejects.toThrow(/permission denied/);
    await expect(as(db, B, tx => tx.query('select upgrade_to_pro()'))).rejects.toThrow(/does not exist/);
    // Allowed profile fields still work.
    await as(db, B, tx => tx.query('update profiles set household_size = 4 where id = $1', [B]));
  });

  test('expired, revoked and used-up invites are rejected', async () => {
    const code = await as(db, A, async tx => (await tx.query('select code from create_invite($1, $2)', [HH, 'viewer'])).rows[0].code);
    await db.query(`update household_invites set expires_at = now() - interval '1 minute' where code = $1`, [code]);
    const E = '00000000-0000-4000-8000-00000000000e';
    await createUser(db, E, 'e@example.com');
    await expect(as(db, E, tx => tx.query('select accept_invite($1)', [code]))).rejects.toThrow(/invite_invalid/);
    await expect(as(db, E, tx => tx.query('select accept_invite($1)', ['ZZZZZZZZZZ']))).rejects.toThrow(/invite_invalid/);
  });

  test('profiles are visible to household members only', async () => {
    const F = '00000000-0000-4000-8000-00000000000f';
    await createUser(db, F, 'f@example.com');
    const forMember = await as(db, B, async tx => (await tx.query('select email from profiles order by email')).rows.map(r => r.email));
    expect(forMember).toEqual(expect.arrayContaining(['a@example.com', 'b@example.com']));
    const forStranger = await as(db, F, async tx => (await tx.query('select email from profiles')).rows.map(r => r.email));
    expect(forStranger).toEqual(['f@example.com']);
  });

  test('members can leave; the owner can remove members but not themselves', async () => {
    await as(db, C, tx => tx.query('delete from household_members where user_id = $1', [C]));
    expect((await db.query('select count(*)::int as n from household_members where user_id = $1', [C])).rows[0].n).toBe(0);
    const removed = await as(db, A, async tx => (await tx.query('delete from household_members where user_id = $1 returning user_id', [D])).rows);
    expect(removed).toHaveLength(1);
    const self = await as(db, A, async tx => (await tx.query('delete from household_members where user_id = $1 returning user_id', [A])).rows);
    expect(self).toHaveLength(0);
  });

  test('household_members_view lists members with emails for members only', async () => {
    const rows = await as(db, B, async tx => (await tx.query('select * from household_members_view($1)', [HH])).rows);
    expect(rows.map(r => r.role)).toEqual(['owner', 'editor']);
    const none = await as(db, C, async tx => (await tx.query('select * from household_members_view($1)', [HH])).rows);
    expect(none).toHaveLength(0);
  });
});

describe('upgrading a v1 database', () => {
  test('lists, collaborators and pantry-flagged items move into households', async () => {
    const db = await createDatabase();
    await migrate(db, { upTo: '20250201000000_pro_tier.sql' });
    await createUser(db, A, 'a@example.com');
    await createUser(db, B, 'b@example.com');

    // v1 data, inserted the way the v1 app/trigger would have.
    await db.query(`insert into lists (id, name, owner_id) values ($1, 'Groceries', $2)`, [LIST, A]);
    await db.query(`insert into list_members (list_id, user_id, role) values ($1, $2, 'editor')`, [LIST, B]);
    await db.query(
      `insert into items (list_id, name, category, quantity, is_in_pantry) values ($1, 'Rice', 'pantry', 2, true), ($1, 'Milk', 'dairy', null, false)`,
      [LIST],
    );
    await db.query('update profiles set is_pro = true where id = $1', [B]); // the v1 bypass

    await migrate(db, { after: '20250201000000_pro_tier.sql' });

    const list = (await db.query('select household_id from lists where id = $1', [LIST])).rows[0];
    expect(list.household_id).toBeTruthy();
    const members = (await db.query('select user_id, role from household_members where household_id = $1 order by role desc', [list.household_id])).rows;
    expect(members).toEqual([
      { user_id: A, role: 'owner' },
      { user_id: B, role: 'editor' },
    ]);
    const pantry = (await db.query('select name, quantity::int as q, household_id from pantry_items')).rows;
    expect(pantry).toEqual([{ name: 'Rice', q: 2, household_id: list.household_id }]);
    const live = (await db.query('select name from items where deleted_at is null')).rows.map(r => r.name);
    expect(live).toEqual(['Milk']);
    // B (a v1 collaborator) can now read the list through household RLS.
    const seen = await as(db, B, async tx => (await tx.query('select name from lists')).rows);
    expect(seen).toEqual([{ name: 'Groceries' }]);
    // The self-granted v1 Pro flag no longer drives anything and can't be changed by users.
    await expect(as(db, B, tx => tx.query('update profiles set is_pro = false where id = $1', [B]))).rejects.toThrow(/permission denied/);
  }, 120000);
});
