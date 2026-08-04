import { Router } from 'express';
import { postLogin, postRegister } from '../controllers/auth.controller.js';

export const authRouter: Router = Router();

authRouter.post('/register', postRegister);
authRouter.post('/login', postLogin);
