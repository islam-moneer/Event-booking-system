import { Router } from 'express';
import { getMe, postLogin, postRegister } from '../controllers/auth.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

export const authRouter: Router = Router();

authRouter.post('/register', postRegister);
authRouter.post('/login', postLogin);
authRouter.get('/me', requireAuth, getMe);
