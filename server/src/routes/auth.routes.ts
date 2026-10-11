import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { changePasswordSchema, loginRequestSchema } from '@app/shared';
import { config } from '../config';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';
import * as auth from '../controllers/auth.controller';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: config.isTest ? 1000 : 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: 'Слишком много попыток входа. Повторите через 15 минут' },
});

export const authRouter = Router();

authRouter.post('/login', loginLimiter, validate(loginRequestSchema), asyncHandler(auth.login));
authRouter.post('/refresh', asyncHandler(auth.refresh));
authRouter.post('/logout', asyncHandler(auth.logout));
authRouter.post('/change-password', authenticate, validate(changePasswordSchema), asyncHandler(auth.changePassword));
