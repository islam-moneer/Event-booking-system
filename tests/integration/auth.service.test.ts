import { describe, expect, it } from 'vitest';
import { ConflictError, UnauthorizedError, ValidationError } from '../../src/errors.js';
import {
  dummyHash,
  login,
  parseCredentials,
  register,
  signToken,
  verifyToken,
} from '../../src/services/auth.service.js';
import { hashPassword } from '../../src/models/user.js';

const BCRYPT_COST = /^\$2[aby]\$(\d+)\$/;

describe('auth service', () => {
  it('register returns the created user without any password field', async () => {
    const user = await register({ email: '  Ada@Example.COM ', password: 'secret123' });

    expect(user).toEqual({
      id: expect.any(Number),
      email: 'ada@example.com',
      created_at: expect.any(Date),
    });
    expect(Object.keys(user)).not.toContain('password');
    expect(Object.keys(user)).not.toContain('password_hash');
    expect(JSON.stringify(user)).not.toContain('secret123');
  });

  it('register rejects an email that is already registered', async () => {
    await register({ email: 'dup@example.com', password: 'secret123' });

    await expect(register({ email: 'DUP@example.com', password: 'other456' })).rejects.toThrow(
      ConflictError,
    );
  });

  it('login returns a JWT that verifies back to the user id', async () => {
    const created = await register({ email: 'ada@example.com', password: 'secret123' });

    const { token, user } = await login({ email: 'ADA@example.com ', password: 'secret123' });

    expect(user).toEqual(created);
    expect(verifyToken(token).userId).toBe(created.id);
    expect(verifyToken(signToken({ id: created.id })).userId).toBe(created.id);
    expect(() => verifyToken(`${token}tampered`)).toThrow(UnauthorizedError);
    expect(() => verifyToken('not-a-jwt')).toThrow(UnauthorizedError);
  });

  it('login rejects a wrong password with UnauthorizedError', async () => {
    await register({ email: 'ada@example.com', password: 'secret123' });

    const wrongPassword = login({ email: 'ada@example.com', password: 'wrong-one' });
    await expect(wrongPassword).rejects.toThrow(UnauthorizedError);
    await expect(wrongPassword).rejects.toThrow('invalid email or password');

    // Same message for an unknown email: no user enumeration.
    const unknownEmail = login({ email: 'nobody@example.com', password: 'secret123' });
    await expect(unknownEmail).rejects.toThrow(UnauthorizedError);
    await expect(unknownEmail).rejects.toThrow('invalid email or password');
  });

  it('login uses a dummy hash at the same bcrypt cost as real password hashes', async () => {
    const realHash = await hashPassword('secret123');
    const realCost = realHash.match(BCRYPT_COST)?.[1];
    const dummyCost = (await dummyHash).match(BCRYPT_COST)?.[1];

    expect(dummyCost).toBeDefined();
    expect(dummyCost).toBe(realCost);
  });

  it('parseCredentials rejects a password shorter than 8 characters', () => {
    expect(() => parseCredentials({ email: 'ada@example.com', password: 'short7c' })).toThrow(
      ValidationError,
    );

    expect(parseCredentials({ email: '  Ada@Example.com ', password: 'exactly8' })).toEqual({
      email: 'Ada@Example.com',
      password: 'exactly8',
    });

    for (const body of [
      null,
      'ada@example.com',
      {},
      { email: 'ada@example.com' },
      { password: 'secret123' },
      { email: 'no-at-sign', password: 'secret123' },
      { email: 'no@dot', password: 'secret123' },
      { email: 'spaced out@example.com', password: 'secret123' },
      { email: 42, password: 'secret123' },
      { email: 'ada@example.com', password: 12345678 },
    ]) {
      expect(() => parseCredentials(body)).toThrow(ValidationError);
    }
  });
});
