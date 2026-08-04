import { db } from '../config/db.js';
import { ConflictError } from '../errors.js';
import { hashPassword, normalizeEmail, type User } from '../models/user.js';

const UNIQUE_VIOLATION = '23505';

export async function createUser(input: { email: string; password: string }): Promise<User> {
  const email = normalizeEmail(input.email);
  const password_hash = await hashPassword(input.password);

  try {
    const [row] = await db('users').insert({ email, password_hash }).returning('*');
    return row as User;
  } catch (err) {
    // Let the unique index decide, not a pre-SELECT: two concurrent signups for
    // the same email would both pass a pre-check and one would still blow up here.
    if ((err as { code?: string }).code === UNIQUE_VIOLATION) {
      throw new ConflictError('email already registered');
    }
    throw err;
  }
}

export async function findUserByEmail(email: string): Promise<User | undefined> {
  return db<User>('users')
    .where({ email: normalizeEmail(email) })
    .first();
}

export async function findUserById(id: number): Promise<User | undefined> {
  return db<User>('users').where({ id }).first();
}
