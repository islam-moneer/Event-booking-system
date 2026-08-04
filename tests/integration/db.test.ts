import { describe, expect, it } from 'vitest';
import { db } from '../../src/config/db.js';
import { env } from '../../src/config/env.js';

describe('database connection', () => {
  it('connects to the test database, not the development one', async () => {
    const { rows } = await db.raw<{ rows: { name: string }[] }>(
      'select current_database() as name',
    );
    expect(rows[0]?.name).toBe('ebs_test');
  });

  it('loads .env.test, so the lock TTL is short enough to test expiry', () => {
    expect(env.nodeEnv).toBe('test');
    expect(env.checkoutLockTtlSeconds).toBeLessThan(10);
  });

  it('has applied the users migration to the test database', async () => {
    const hasUsersTable = await db.schema.hasTable('users');
    expect(hasUsersTable).toBe(true);
  });

  it('loads the JWT secret from the environment', () => {
    expect(env.jwtSecret).toBeTruthy();
    expect(typeof env.jwtSecret).toBe('string');
  });
});
