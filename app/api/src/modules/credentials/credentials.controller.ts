import type { Request, Response } from 'express';
import { currentUser } from '../../core/auth.ts';
import { idParam, validQuery } from '../../core/validate.ts';
import * as credentials from './credentials.service.ts';

// ---------- Сотрудник: свои удостоверения ----------

export async function listOwn(req: Request, res: Response) {
  res.json(await credentials.listOwn(currentUser(req).id));
}

export async function updateOwn(req: Request, res: Response) {
  res.json(await credentials.updateOwn(currentUser(req), idParam(req), req.body.issueDate));
}

export async function clearOwn(req: Request, res: Response) {
  res.json(await credentials.clearOwn(currentUser(req), idParam(req)));
}

// ---------- Администратор ----------

export async function list(req: Request, res: Response) {
  res.json(await credentials.adminList(validQuery(req)));
}

export async function update(req: Request, res: Response) {
  res.json(await credentials.adminUpdate(currentUser(req), idParam(req), req.body));
}

export async function clear(req: Request, res: Response) {
  res.json(await credentials.adminClear(currentUser(req), idParam(req)));
}

export async function mark(req: Request, res: Response) {
  res.json(await credentials.adminMark(currentUser(req), idParam(req)));
}

export async function unmark(req: Request, res: Response) {
  res.json(await credentials.adminUnmark(currentUser(req), idParam(req)));
}
