import type { Request, Response } from 'express';
import { currentUser } from '../middleware/auth.ts';
import { idParam, validQuery } from '../middleware/validate.ts';
import * as users from '../services/users.service.ts';
import * as catalog from '../services/catalog.service.ts';
import * as credentials from '../services/credentials.service.ts';
import * as messages from '../services/messages.service.ts';
import * as auditLog from '../services/auditLog.service.ts';
import { getDashboard } from '../services/dashboard.service.ts';
import * as positions from '../services/positions.service.ts';
import { getOverview } from '../services/overview.service.ts';

// ---------- Дашборд ----------

export async function dashboard(req: Request, res: Response) {
  res.json(await getDashboard(currentUser(req)));
}

// ---------- Пользователи ----------

export async function listUsers(req: Request, res: Response) {
  res.json(await users.list(validQuery(req)));
}

export async function userOptions(_req: Request, res: Response) {
  res.json(await users.listOptions());
}

export async function getUser(req: Request, res: Response) {
  const id = idParam(req);
  const [user, userCredentials] = await Promise.all([users.getById(id), credentials.adminListForUser(id)]);
  res.json({ user, credentials: userCredentials });
}

export async function createUser(req: Request, res: Response) {
  res.status(201).json(await users.create(currentUser(req), req.body));
}

export async function updateUser(req: Request, res: Response) {
  res.json(await users.update(currentUser(req), idParam(req), req.body));
}

export async function deleteUser(req: Request, res: Response) {
  await users.softDelete(currentUser(req), idParam(req));
  res.status(204).end();
}

export async function resetPassword(req: Request, res: Response) {
  await users.resetPassword(currentUser(req), idParam(req), req.body.password);
  res.status(204).end();
}

// ---------- Справочник ----------

export async function listCatalog(req: Request, res: Response) {
  res.json(await catalog.list(req.query.archived === 'true'));
}

export async function createCatalogItem(req: Request, res: Response) {
  res.status(201).json(await catalog.create(currentUser(req), req.body));
}

export async function updateCatalogItem(req: Request, res: Response) {
  res.json(await catalog.update(currentUser(req), idParam(req), req.body));
}

export async function archiveCatalogItem(req: Request, res: Response) {
  res.json(await catalog.setArchived(currentUser(req), idParam(req), true));
}

export async function unarchiveCatalogItem(req: Request, res: Response) {
  res.json(await catalog.setArchived(currentUser(req), idParam(req), false));
}

// ---------- Удостоверения ----------

export async function listCredentials(req: Request, res: Response) {
  res.json(await credentials.adminList(validQuery(req)));
}

export async function updateCredential(req: Request, res: Response) {
  res.json(await credentials.adminUpdate(currentUser(req), idParam(req), req.body));
}

export async function clearCredential(req: Request, res: Response) {
  res.json(await credentials.adminClear(currentUser(req), idParam(req)));
}

export async function markCredential(req: Request, res: Response) {
  res.json(await credentials.adminMark(currentUser(req), idParam(req)));
}

export async function unmarkCredential(req: Request, res: Response) {
  res.json(await credentials.adminUnmark(currentUser(req), idParam(req)));
}

// ---------- Сообщения и журнал ----------

export async function sendMessage(req: Request, res: Response) {
  res.status(201).json(await messages.send(currentUser(req), req.body));
}

export async function messageHistory(req: Request, res: Response) {
  res.json(await messages.history(validQuery(req)));
}

export async function listAuditLog(req: Request, res: Response) {
  res.json(await auditLog.list(validQuery(req)));
}

// ---------- Должности и сводная таблица ----------

export async function listPositions(req: Request, res: Response) {
  res.json(await positions.list(req.query.archived === 'true'));
}

export async function createPosition(req: Request, res: Response) {
  res.status(201).json(await positions.create(currentUser(req), req.body));
}

export async function updatePosition(req: Request, res: Response) {
  res.json(await positions.update(currentUser(req), idParam(req), req.body));
}

export async function archivePosition(req: Request, res: Response) {
  res.json(await positions.setArchived(currentUser(req), idParam(req), true));
}

export async function unarchivePosition(req: Request, res: Response) {
  res.json(await positions.setArchived(currentUser(req), idParam(req), false));
}

export async function overview(req: Request, res: Response) {
  res.json(await getOverview(validQuery(req)));
}
