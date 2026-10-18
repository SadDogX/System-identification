import type { Request, Response } from 'express';
import { currentUser } from '../../core/auth.ts';
import { idParam } from '../../core/validate.ts';
import * as service from './positions.service.ts';

export async function list(req: Request, res: Response) {
  res.json(await service.list(req.query.archived === 'true'));
}

export async function create(req: Request, res: Response) {
  res.status(201).json(await service.create(currentUser(req), req.body));
}

export async function update(req: Request, res: Response) {
  res.json(await service.update(currentUser(req), idParam(req), req.body));
}

export async function archive(req: Request, res: Response) {
  res.json(await service.setArchived(currentUser(req), idParam(req), true));
}

export async function unarchive(req: Request, res: Response) {
  res.json(await service.setArchived(currentUser(req), idParam(req), false));
}
