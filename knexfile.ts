import type { Knex } from 'knex';
import { env } from './src/config/env.js';

// env.ts already picked .env or .env.test from NODE_ENV, so DATABASE_URL is
// the right one for the environment — the per-environment blocks below only
// differ in pool sizing.
const base: Knex.Config = {
  client: 'pg',
  connection: env.databaseUrl,
  migrations: { directory: './migrations', extension: 'ts' },
  seeds: { directory: './seeds', extension: 'ts' },
};

const config: Record<string, Knex.Config> = {
  development: { ...base, pool: { min: 2, max: 10 } },
  // Concurrency tests open several transactions at once; a pool smaller than
  // the number of racing requests would serialise them and hide the race.
  test: { ...base, pool: { min: 2, max: 10 } },
  production: { ...base, pool: { min: 2, max: 20 } },
};

export default config;
