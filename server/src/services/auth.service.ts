import bcrypt from 'bcryptjs';
import type { User } from '@prisma/client';
import type { AuthResponse, ChangePasswordRequest, LoginRequest } from '@app/shared';
import { prisma } from '../db';
import { badRequest, unauthorized } from '../utils/errors';
import { toUserDto } from '../utils/mappers';
import { isUsable } from '../middleware/auth';
import { getSettings } from './settings.service';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from './token.service';

const BCRYPT_ROUNDS = 10;
// Хеш-заглушка, чтобы время ответа не выдавало существование логина
const DUMMY_HASH = bcrypt.hashSync('dummy-password', BCRYPT_ROUNDS);

export const hashPassword = (password: string) => bcrypt.hash(password, BCRYPT_ROUNDS);

interface Session {
  response: AuthResponse;
  refreshToken: string;
}

async function createSession(user: User): Promise<Session> {
  return {
    response: { accessToken: signAccessToken(user), user: toUserDto(user), settings: await getSettings() },
    refreshToken: signRefreshToken(user),
  };
}

export async function login({ login, password }: LoginRequest): Promise<Session> {
  const user = await prisma.user.findUnique({ where: { login } });
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok || user.isDeleted) throw unauthorized('Неверный логин или пароль');
  if (!user.isActive) throw unauthorized('Учётная запись заблокирована');
  return createSession(user);
}

export async function refresh(token: string | undefined): Promise<Session> {
  const payload = token ? verifyRefreshToken(token) : null;
  if (!payload) throw unauthorized('Сессия истекла');
  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!isUsable(user) || user.tokenVersion !== payload.ver) throw unauthorized('Сессия недействительна');
  return createSession(user);
}

/** После смены пароля все остальные сессии завершаются. */
export async function changePassword(user: User, data: ChangePasswordRequest): Promise<Session> {
  if (!(await bcrypt.compare(data.currentPassword, user.passwordHash))) {
    throw badRequest('Ошибка валидации', { currentPassword: 'Неверный текущий пароль' });
  }
  if (data.currentPassword === data.newPassword) {
    throw badRequest('Ошибка валидации', { newPassword: 'Новый пароль должен отличаться от текущего' });
  }
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(data.newPassword),
      mustChangePassword: false,
      tokenVersion: { increment: 1 },
    },
  });
  return createSession(updated);
}
