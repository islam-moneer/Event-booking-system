import { afterAll, beforeEach } from 'vitest';
import { db } from '../src/config/db.js';

const PRESERVE = ['knex_migrations', 'knex_migrations_lock'];

// Safety rail: this file truncates every table it finds. If NODE_ENV or
// DATABASE_URL is ever misconfigured, that would wipe the development
// database instead. Refuse to touch anything not named *_test.
async function assertTestDatabase() {
  const { rows } = await db.raw<{ rows: { name: string }[] }>('select current_database() as name');
  const name = rows[0]?.name;
  if (!name?.endsWith('_test')) {
    throw new Error(`Refusing to run tests against database "${name}" — name must end in _test`);
  }
}

beforeEach(async () => {
  await assertTestDatabase();

  const { rows } = await db.raw<{ rows: { tablename: string }[] }>(
    "select tablename from pg_tables where schemaname = 'public'",
  );
  const tables = rows.map((r) => r.tablename).filter((t) => !PRESERVE.includes(t));
  if (tables.length === 0) return;

  // RESTART IDENTITY so sequence-backed ids are deterministic per test;
  // CASCADE so foreign keys don't force a hand-maintained truncate order.
  const list = tables.map((t) => `"${t}"`).join(', ');
  await db.raw(`truncate table ${list} restart identity cascade`);
});

afterAll(async () => {
  await db.destroy();
});
