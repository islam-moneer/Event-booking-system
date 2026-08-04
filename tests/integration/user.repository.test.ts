import { describe, expect, it } from 'vitest';
import { db } from '../../src/config/db.js';
import { ConflictError } from '../../src/errors.js';
import { verifyPassword } from '../../src/models/user.js';
import {
  createUser,
  findUserByEmail,
  findUserById,
} from '../../src/repositories/user.repository.js';

describe('user repository', () => {
  it('stores a bcrypt hash instead of the plaintext password', async () => {
    const user = await createUser({ email: 'ada@example.com', password: 'plaintext' });

    const row = await db('users').where({ id: user.id }).first();
    expect(row).toBeDefined();
    expect(row.password_hash).not.toBe('plaintext');
    expect(row.password_hash.startsWith('$2')).toBe(true);
    await expect(verifyPassword('plaintext', row.password_hash)).resolves.toBe(true);
    await expect(verifyPassword('wrong', row.password_hash)).resolves.toBe(false);
  });

  it('finds a user by email regardless of casing or surrounding whitespace', async () => {
    const created = await createUser({ email: '  Ada@Example.COM ', password: 'secret123' });
    expect(created.email).toBe('ada@example.com');

    for (const lookup of ['ada@example.com', 'ADA@EXAMPLE.COM', '  Ada@Example.com  ']) {
      const found = await findUserByEmail(lookup);
      expect(found?.id).toBe(created.id);
    }

    expect(await findUserByEmail('nobody@example.com')).toBeUndefined();
    expect((await findUserById(created.id))?.email).toBe('ada@example.com');
    expect(await findUserById(created.id + 1)).toBeUndefined();
  });

  it('rejects a duplicate email with a ConflictError', async () => {
    await createUser({ email: 'dup@example.com', password: 'secret123' });

    await expect(createUser({ email: 'DUP@example.com ', password: 'other456' })).rejects.toThrow(
      ConflictError,
    );

    const rows = await db('users').where({ email: 'dup@example.com' });
    expect(rows).toHaveLength(1);
  });
});
