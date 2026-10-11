import jwt from 'jsonwebtoken';
import type { Role } from '@prisma/client';
import { config } from '../config';

export interface AccessPayload {
  sub: number;
  role: Role;
  ver: number;
}

interface RefreshPayload {
  sub: number;
  ver: number;
}

export function signAccessToken(user: { id: number; role: Role; tokenVersion: number }): string {
  const payload: AccessPayload = { sub: user.id, role: user.role, ver: user.tokenVersion };
  return jwt.sign(payload, config.jwtAccessSecret, { expiresIn: config.accessTokenTtlSeconds });
}

export function signRefreshToken(user: { id: number; tokenVersion: number }): string {
  const payload: RefreshPayload = { sub: user.id, ver: user.tokenVersion };
  return jwt.sign(payload, config.jwtRefreshSecret, { expiresIn: config.refreshTokenTtlDays * 24 * 60 * 60 });
}

function verify<T>(token: string, secret: string): T | null {
  try {
    const decoded = jwt.verify(token, secret);
    return typeof decoded === 'object' ? (decoded as unknown as T) : null;
  } catch {
    return null;
  }
}

export const verifyAccessToken = (token: string) => verify<AccessPayload>(token, config.jwtAccessSecret);
export const verifyRefreshToken = (token: string) => verify<RefreshPayload>(token, config.jwtRefreshSecret);
