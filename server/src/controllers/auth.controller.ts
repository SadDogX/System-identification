import type { Request, Response } from 'express';
import { config } from '../config';
import { currentUser } from '../middleware/auth';
import * as authService from '../services/auth.service';

const REFRESH_COOKIE = 'refresh_token';

function setRefreshCookie(res: Response, token: string) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: config.isProduction,
    path: '/api/auth',
    maxAge: config.refreshTokenTtlDays * 24 * 60 * 60 * 1000,
  });
}

export async function login(req: Request, res: Response) {
  const session = await authService.login(req.body);
  setRefreshCookie(res, session.refreshToken);
  res.json(session.response);
}

export async function refresh(req: Request, res: Response) {
  const session = await authService.refresh(req.cookies?.[REFRESH_COOKIE]);
  setRefreshCookie(res, session.refreshToken);
  res.json(session.response);
}

export async function logout(_req: Request, res: Response) {
  res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
  res.status(204).end();
}

export async function changePassword(req: Request, res: Response) {
  const session = await authService.changePassword(currentUser(req), req.body);
  setRefreshCookie(res, session.refreshToken);
  res.json(session.response);
}
