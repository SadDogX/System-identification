import type { Role } from '@prisma/client';
import { config } from '../config.ts';
import { signJwt, verifyJwt } from '../utils/jwt.ts';

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
  return signJwt(payload, config.jwtAccessSecret, config.accessTokenTtlSeconds);
}

export function signRefreshToken(user: { id: number; tokenVersion: number }): string {
  const payload: RefreshPayload = { sub: user.id, ver: user.tokenVersion };
  return signJwt(payload, config.jwtRefreshSecret, config.refreshTokenTtlDays * 24 * 60 * 60);
}

export const verifyAccessToken = (token: string) => verifyJwt<AccessPayload>(token, config.jwtAccessSecret);
export const verifyRefreshToken = (token: string) => verifyJwt<RefreshPayload>(token, config.jwtRefreshSecret);
