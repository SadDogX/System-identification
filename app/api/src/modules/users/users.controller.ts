import type { Request, Response } from 'express';
import { currentUser } from '../../core/auth.ts';
import { idParam, validQuery } from '../../core/validate.ts';
import { toUserDto } from '../../core/mappers.ts';
import { getSettings } from '../../core/settings.ts';
import * as users from './users.service.ts';
import { adminListForUser } from '../credentials/credentials.service.ts';

// ---------- Администратор ----------

export async function list(req: Request, res: Response) {
  res.json(await users.list(validQuery(req)));
}

export async function options(_req: Request, res: Response) {
  res.json(await users.listOptions());
}

export async function archive(req: Request, res: Response) { res.json(await users.archive(validQuery(req))); }
export async function dependencies(req: Request, res: Response) { res.json(await users.dependencies(idParam(req))); }
export async function unlock(req: Request, res: Response) { res.json(await users.unlock(currentUser(req), idParam(req))); }
export async function restore(req: Request, res: Response) { res.json(await users.restore(currentUser(req), idParam(req))); }

export async function getOne(req: Request, res: Response) {
  const id = idParam(req);
  const [user, credentials] = await Promise.all([users.getById(id), adminListForUser(id)]);
  res.json({ user, credentials });
}

export async function create(req: Request, res: Response) {
  res.status(201).json(await users.create(currentUser(req), req.body));
}

export async function update(req: Request, res: Response) {
  res.json(await users.update(currentUser(req), idParam(req), req.body));
}

export async function remove(req: Request, res: Response) {
  await users.softDelete(currentUser(req), idParam(req));
  res.status(204).end();
}

export async function resetPassword(req: Request, res: Response) {
  await users.resetPassword(currentUser(req), idParam(req), req.body.password);
  res.status(204).end();
}

// ---------- Собственный профиль ----------

export async function me(req: Request, res: Response) {
  res.json({ user: toUserDto(currentUser(req)), settings: await getSettings() });
}

export async function updateProfile(req: Request, res: Response) {
  res.json(await users.updateProfile(currentUser(req), req.body));
}

export async function updateUiSettings(req: Request, res: Response) {
  res.json(await users.updateUiSettings(currentUser(req), req.body));
}
