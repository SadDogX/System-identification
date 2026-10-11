import type { Request, Response } from 'express';
import { z } from 'zod';
import { paginationQuerySchema } from '@app/shared';
import { currentUser } from '../middleware/auth';
import { idParam, validQuery } from '../middleware/validate';
import { toUserDto } from '../utils/mappers';
import { getSettings } from '../services/settings.service';
import * as users from '../services/users.service';
import * as credentials from '../services/credentials.service';
import * as notifications from '../services/notifications.service';

export const notificationsQuerySchema = paginationQuerySchema.extend({
  kind: z.enum(['MESSAGE', 'EXPIRY']).optional(),
});

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
