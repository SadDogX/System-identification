import type { NextFunction, Request, Response } from 'express';
import type { User } from '@prisma/client';
import { prisma, withPosition, type UserWithPosition } from './db.ts';
import { forbidden, unauthorized } from './errors.ts';
import { asyncHandler } from './asyncHandler.ts';
import { verifyAccessToken } from '../modules/auth/token.service.ts';

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

/** Legacy ADMIN accounts and the corresponding active system grant are both administrative. */
export async function isAdministrator(user: User): Promise<boolean> {
  if (user.role === 'ADMIN') return true;
  return !!(await prisma.userSystemRole.findFirst({
    where: { userId: user.id, revokedAt: null, systemRole: { code: 'ADMIN', isActive: true } },
    select: { id: true },
  }));
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

/** System-role guard used by every module boundary; role grants are read live so revocation is immediate. */
export const requireSystemRole = (...roles: string[]) =>
  asyncHandler(async (req, _res, next) => {
    const user = currentUser(req);
    const grant = await prisma.userSystemRole.findFirst({
      where: { userId: user.id, revokedAt: null, systemRole: { code: { in: roles }, isActive: true } },
      select: { id: true },
    });
    if (!grant) throw forbidden();
    next();
  });

/** Пока не сменён временный пароль, доступны только /auth и /me. */
export function requirePasswordChanged(req: Request, _res: Response, next: NextFunction) {
  if (currentUser(req).mustChangePassword) return next(forbidden('Необходимо сменить временный пароль'));
  next();
}
