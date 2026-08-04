import type { NextFunction, Request, Response } from 'express';
import { UnauthorizedError } from '../errors.js';
import { verifyToken } from '../services/auth.service.js';

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const [scheme, token] = (req.header('authorization') ?? '').split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    next(new UnauthorizedError('missing bearer token'));
    return;
  }

  try {
    const { userId } = verifyToken(token);
    req.user = { id: userId };
  } catch (err) {
    // Never respond from here: the error middleware owns every response shape.
    next(err);
    return;
  }

  next();
}
