import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { UnauthorizedError, ValidationError } from '../errors.js';
import { hashPassword, toPublicUser, verifyPassword, type PublicUser } from '../models/user.js';
import { createUser, findUserByEmail } from '../repositories/user.repository.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_BYTES = 72; // bcrypt truncates beyond this
const MAX_EMAIL_LENGTH = 254; // RFC 5321

// Hash of an arbitrary string at the real ROUNDS cost, used only so login()
// can pay the same bcrypt cost for an unknown email as for a wrong password.
// Computed once at module load (not a literal) so it can never drift from
// ROUNDS in user.ts; the promise is cached and awaited, so the first
// unknown-email login doesn't pay for it twice.
export const dummyHash = hashPassword('correct horse battery staple');

// Hand-rolled instead of a schema library: two fields, and the error shape is
// already ours. Swap for zod when a request body outgrows this.
export function parseCredentials(body: unknown): { email: string; password: string } {
  if (typeof body !== 'object' || body === null) {
    throw new ValidationError('body must be an object');
  }

  const { email, password } = body as { email?: unknown; password?: unknown };

  if (typeof email !== 'string' || !EMAIL_PATTERN.test(email.trim())) {
    throw new ValidationError('email must be a valid email address');
  }
  if (email.trim().length > MAX_EMAIL_LENGTH) {
    throw new ValidationError(`email must be at most ${MAX_EMAIL_LENGTH} characters`);
  }
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    throw new ValidationError(`password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }
  if (Buffer.byteLength(password) > MAX_PASSWORD_BYTES) {
    throw new ValidationError(`password must be at most ${MAX_PASSWORD_BYTES} bytes`);
  }

  return { email: email.trim(), password };
}

export function signToken(user: { id: number }): string {
  return jwt.sign({ sub: String(user.id) }, env.jwtSecret, {
    expiresIn: env.jwtExpiresInSeconds,
  });
}

export function verifyToken(token: string): { userId: number } {
  let payload: jwt.JwtPayload | string;
  try {
    payload = jwt.verify(token, env.jwtSecret);
  } catch {
    // Expired, tampered, malformed — the caller gets one answer, not a taxonomy.
    throw new UnauthorizedError('invalid token');
  }

  const sub = typeof payload === 'string' ? undefined : payload.sub;
  const userId = Number(sub);
  if (typeof sub !== 'string' || sub === '' || !Number.isInteger(userId)) {
    throw new UnauthorizedError('invalid token');
  }

  return { userId };
}

export async function register(input: { email: string; password: string }): Promise<PublicUser> {
  // A duplicate email surfaces as the repository's ConflictError; no pre-check.
  return toPublicUser(await createUser(input));
}

export async function login(input: {
  email: string;
  password: string;
}): Promise<{ token: string; user: PublicUser }> {
  const user = await findUserByEmail(input.email);
  // Same message whether the email is unknown or the password is wrong:
  // a different one would turn login into an account-existence oracle. Running
  // bcrypt against a dummy hash for the unknown-email case keeps the timing
  // the same too, so response time can't be used as the oracle instead.
  if (!user) {
    await verifyPassword(input.password, await dummyHash);
    throw new UnauthorizedError('invalid email or password');
  }
  if (!(await verifyPassword(input.password, user.password_hash))) {
    throw new UnauthorizedError('invalid email or password');
  }

  return { token: signToken(user), user: toPublicUser(user) };
}
