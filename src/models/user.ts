import { compare, hash } from 'bcryptjs';
import { env } from '../config/env.js';

export type User = {
  id: number;
  email: string;
  password_hash: string;
  created_at: Date;
  updated_at: Date;
};

// What leaves the API: never the hash.
export type PublicUser = { id: number; email: string; created_at: Date };

// bcryptjs is pure JS, so every fixture pays the full cost factor. 10 rounds
// per test user makes the suite crawl; 4 is still a real bcrypt hash.
// Exported so callers needing a same-cost dummy hash (see auth.service.ts)
// can't drift from the real value.
export const ROUNDS = env.nodeEnv === 'test' ? 4 : 10;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function toPublicUser(user: User): PublicUser {
  return { id: user.id, email: user.email, created_at: user.created_at };
}

export function hashPassword(plain: string): Promise<string> {
  return hash(plain, ROUNDS);
}

export function verifyPassword(plain: string, passwordHash: string): Promise<boolean> {
  return compare(plain, passwordHash);
}
