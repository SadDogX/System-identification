import type { User } from '@prisma/client';
import type { AuthResponse, ChangePasswordRequest, LoginRequest } from '@app/shared';
import { prisma, withPosition, type UserWithPosition } from '../db.ts';
import { badRequest, unauthorized } from '../utils/errors.ts';
import { toUserDto } from '../utils/mappers.ts';
import { isUsable } from '../middleware/auth.ts';
import { getSettings } from './settings.service.ts';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from './token.service.ts';
import { hashPassword, verifyPassword } from '../utils/password.ts';

export { hashPassword };

// Хеш-заглушка, чтобы время ответа не выдавало существование логина
const DUMMY_HASH = await hashPassword('dummy-password');

interface Session {
  response: AuthResponse;
  refreshToken: string;
}

async function createSession(user: UserWithPosition): Promise<Session> {
  return {
    response: { accessToken: signAccessToken(user), user: toUserDto(user), settings: await getSettings() },
    refreshToken: signRefreshToken(user),
  };
}

export async function login({ login, password }: LoginRequest): Promise<Session> {
  const user = await prisma.user.findUnique({ where: { login }, include: withPosition });
  const ok = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok || user.isDeleted) throw unauthorized('Неверный логин или пароль');
  if (!user.isActive) throw unauthorized('Учётная запись заблокирована');
  return createSession(user);
}

export async function refresh(token: string | undefined): Promise<Session> {
  const payload = token ? verifyRefreshToken(token) : null;
  if (!payload) throw unauthorized('Сессия истекла');
  const user = await prisma.user.findUnique({ where: { id: payload.sub }, include: withPosition });
  if (!isUsable(user) || user.tokenVersion !== payload.ver) throw unauthorized('Сессия недействительна');
  return createSession(user);
}

/** После смены пароля все остальные сессии завершаются. */
export async function changePassword(user: User, data: ChangePasswordRequest): Promise<Session> {
  if (!(await verifyPassword(data.currentPassword, user.passwordHash))) {
    throw badRequest('Ошибка валидации', { currentPassword: 'Неверный текущий пароль' });
  }
  if (data.currentPassword === data.newPassword) {
    throw badRequest('Ошибка валидации', { newPassword: 'Новый пароль должен отличаться от текущего' });
  }
  const updated = await prisma.user.update({
    where: { id: user.id },
    include: withPosition,
    data: {
      passwordHash: await hashPassword(data.newPassword),
      mustChangePassword: false,
      tokenVersion: { increment: 1 },
    },
  });
  return createSession(updated);
}
