import type { Request, Response } from 'express';
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
