import type { NextFunction, Request, Response } from 'express';
import type { Role, User } from '@prisma/client';
import { prisma, withPosition, type UserWithPosition } from '../db.ts';
import { forbidden, unauthorized } from '../utils/errors.ts';
import { asyncHandler } from '../utils/asyncHandler.ts';
import { verifyAccessToken } from '../services/token.service.ts';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: UserWithPosition;
    }
  }
}

/** Пользователь, проверенный middleware authenticate. */
export function currentUser(req: Request): UserWithPosition {
  if (!req.user) throw unauthorized();
  return req.user;
}

/** Пользователь, которому разрешено работать с системой. */
export function isUsable(user: User | null): user is User {
  return !!user && user.isActive && !user.isDeleted;
}

/**
 * Проверяет токен, существование и активность пользователя и версию токена.
 * Роль берётся из БД, а не из токена — смена роли действует сразу.
 */
export const authenticate = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw unauthorized();

  const payload = verifyAccessToken(token);
  if (!payload) throw unauthorized('Сессия истекла');

  const user = await prisma.user.findUnique({ where: { id: payload.sub }, include: withPosition });
  if (!isUsable(user) || user.tokenVersion !== payload.ver) throw unauthorized('Сессия недействительна');

  req.user = user;
  next();
});

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const user = currentUser(req);
    if (!roles.includes(user.role)) return next(forbidden());
    next();
  };
}

/** Пока не сменён временный пароль, доступны только /auth и /me. */
export function requirePasswordChanged(req: Request, _res: Response, next: NextFunction) {
  if (currentUser(req).mustChangePassword) return next(forbidden('Необходимо сменить временный пароль'));
  next();
}
