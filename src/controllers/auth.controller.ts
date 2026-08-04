import type { Request, Response } from 'express';
import { UnauthorizedError } from '../errors.js';
import { toPublicUser } from '../models/user.js';
import { findUserById } from '../repositories/user.repository.js';
import { login, parseCredentials, register } from '../services/auth.service.js';

export async function postRegister(req: Request, res: Response): Promise<void> {
  const credentials = parseCredentials(req.body);
  const user = await register(credentials);
  res.status(201).json(user);
}

export async function postLogin(req: Request, res: Response): Promise<void> {
  const credentials = parseCredentials(req.body);
  const result = await login(credentials);
  res.status(200).json(result);
}

export async function getMe(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw new UnauthorizedError('unauthenticated');
  }

  // The token can outlive its user: a deleted account is a stale token, not a 500.
  const user = await findUserById(req.user.id);
  if (!user) {
    throw new UnauthorizedError('invalid token');
  }

  res.status(200).json(toPublicUser(user));
}
