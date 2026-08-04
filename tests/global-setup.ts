import { db } from '../src/config/db.js';

// Runs once per suite run, before any test file. Keeps the test schema in
// sync with migrations so no test has to remember to migrate first.
export async function setup() {
  await db.migrate.latest();
  await db.destroy();
}
