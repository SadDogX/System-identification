import type { Request, Response } from 'express';
import { currentUser } from '../../core/auth.ts';
import { idParam, validQuery } from '../../core/validate.ts';
import * as notifications from './notifications.service.ts';

export async function list(req: Request, res: Response) {
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

export async function dismissRead(req: Request, res: Response) {
  res.json({ dismissed: await notifications.dismissRead(currentUser(req).id) });
}
