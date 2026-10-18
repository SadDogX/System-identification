import { Router } from 'express';
import { changePasswordSchema, loginRequestSchema } from '@app/shared';
import { config } from '../../core/config.ts';
import { authenticate } from '../../core/auth.ts';
import { failedAttemptsLimiter } from '../../core/http.ts';
import { validate } from '../../core/validate.ts';
import { asyncHandler } from '../../core/asyncHandler.ts';
import type { AppModule } from '../../core/module.ts';
import * as auth from './auth.controller.ts';

const loginLimiter = failedAttemptsLimiter({
  limit: config.isTest ? 1000 : 10,
  windowMs: 15 * 60 * 1000,
  message: 'Слишком много попыток входа. Повторите через 15 минут',
});

/** Вход, обновление сессии, выход, смена пароля. */
const authRouter = Router();

authRouter.post('/login', loginLimiter, validate(loginRequestSchema), asyncHandler(auth.login));
authRouter.post('/refresh', asyncHandler(auth.refresh));
authRouter.post('/logout', asyncHandler(auth.logout));
authRouter.post('/change-password', authenticate, validate(changePasswordSchema), asyncHandler(auth.changePassword));

export const authModule: AppModule = {
  name: 'auth',
  routes: [{ path: '/api/auth', router: authRouter }],
};
