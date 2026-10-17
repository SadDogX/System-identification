import { Router } from 'express';
import { changePasswordSchema, loginRequestSchema } from '@app/shared';
import { config } from '../config.ts';
import { authenticate } from '../middleware/auth.ts';
import { failedAttemptsLimiter } from '../middleware/http.ts';
import { validate } from '../middleware/validate.ts';
import { asyncHandler } from '../utils/asyncHandler.ts';
import * as auth from '../controllers/auth.controller.ts';

const loginLimiter = failedAttemptsLimiter({
  limit: config.isTest ? 1000 : 10,
  windowMs: 15 * 60 * 1000,
  message: 'Слишком много попыток входа. Повторите через 15 минут',
});

export const authRouter = Router();

authRouter.post('/login', loginLimiter, validate(loginRequestSchema), asyncHandler(auth.login));
authRouter.post('/refresh', asyncHandler(auth.refresh));
authRouter.post('/logout', asyncHandler(auth.logout));
authRouter.post('/change-password', authenticate, validate(changePasswordSchema), asyncHandler(auth.changePassword));
