// Runs the real migrations inside PGlite (Postgres compiled to WASM) with a
// minimal stand-in for Supabase's auth schema, roles and default grants, so
// RLS policies and RPCs can be tested without Docker or a hosted project.
const fs = require('fs');
const path = require('path');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

const SUPABASE_PRELUDE = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  grant usage on schema public to anon, authenticated, service_role;

  create schema auth;
  grant usage on schema auth to anon, authenticated, service_role;
  create table auth.users (
    id uuid primary key,
    email text,
    created_at timestamptz default now()
  );
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  grant execute on function auth.uid() to anon, authenticated, service_role;

  -- Supabase grants table privileges to these roles by default; RLS does the rest.
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
`;

async function createDatabase() {
  const { PGlite } = require('@electric-sql/pglite');
  const { uuid_ossp } = require('@electric-sql/pglite/contrib/uuid_ossp');
  const db = new PGlite({ extensions: { uuid_ossp } });
  await db.exec(SUPABASE_PRELUDE);
  return db;
}

function migrationFiles() {
  return fs.readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql')).sort();
}

async function migrate(db, { upTo, after } = {}) {
  for (const file of migrationFiles()) {
    if (upTo && file > upTo) break;
    if (after && file <= after) continue;
    await db.exec(fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8'));
  }
}

async function createUser(db, id, email) {
  await db.query('insert into auth.users (id, email) values ($1, $2)', [id, email]);
}

/** Run `fn` as an authenticated user (or anon when userId is null), like PostgREST does. */
async function as(db, userId, fn) {
  return db.transaction(async tx => {
    await tx.exec(`set local role ${userId ? 'authenticated' : 'anon'}`);
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [userId ?? '']);
    return fn(tx);
  });
}

module.exports = { createDatabase, migrate, createUser, as, migrationFiles };
