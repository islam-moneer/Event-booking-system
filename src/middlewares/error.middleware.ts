import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../errors.js';

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } });
    return;
  }

  // body-parser (and other middleware) throw plain errors with a status/statusCode,
  // never AppError. err.body on these can hold the raw request body (e.g. a
  // plaintext password) so only err.type/err.message are ever logged.
  const e = err as {
    status?: unknown;
    statusCode?: unknown;
    type?: string;
    message?: string;
  } | null;
  const status = e?.status ?? e?.statusCode;
  if (typeof status === 'number' && status >= 400 && status < 500) {
    console.error({ type: e?.type, message: e?.message });
    res
      .status(status)
      .json({ error: { code: 'VALIDATION_ERROR', message: e?.message ?? 'invalid request' } });
    return;
  }

  console.error(err);
  res.status(500).json({ error: { code: 'INTERNAL', message: 'internal server error' } });
}
