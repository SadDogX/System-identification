import type { Request, Response } from 'express';
import { currentUser } from '../middleware/auth.ts';
import { idParam, validQuery } from '../middleware/validate.ts';
import { toUserDto } from '../utils/mappers.ts';
import { getSettings } from '../services/settings.service.ts';
import * as users from '../services/users.service.ts';
import * as credentials from '../services/credentials.service.ts';
import * as notifications from '../services/notifications.service.ts';

export async function getMe(req: Request, res: Response) {
  res.json({ user: toUserDto(currentUser(req)), settings: await getSettings() });
}

export async function updateProfile(req: Request, res: Response) {
  res.json(await users.updateProfile(currentUser(req), req.body));
}

export async function updateUiSettings(req: Request, res: Response) {
  res.json(await users.updateUiSettings(currentUser(req), req.body));
}

export async function listCredentials(req: Request, res: Response) {
  res.json(await credentials.listOwn(currentUser(req).id));
}

export async function updateCredential(req: Request, res: Response) {
  res.json(await credentials.updateOwn(currentUser(req), idParam(req), req.body.issueDate));
}

export async function listNotifications(req: Request, res: Response) {
  res.json(await notifications.list(currentUser(req).id, validQuery(req)));
}

export async function unreadCount(req: Request, res: Response) {
  res.json({ count: await notifications.unreadCount(currentUser(req).id) });
}

export async function markRead(req: Request, res: Response) {
  await notifications.markRead(currentUser(req).id, idParam(req));
  res.status(204).end();
}

export async function markAllRead(req: Request, res: Response) {
  await notifications.markAllRead(currentUser(req).id);
  res.status(204).end();
}

export async function clearCredential(req: Request, res: Response) {
  res.json(await credentials.clearOwn(currentUser(req), idParam(req)));
}

export async function dismissRead(req: Request, res: Response) {
  res.json({ dismissed: await notifications.dismissRead(currentUser(req).id) });
}
