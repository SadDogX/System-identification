import type { Request, Response } from 'express';
import { currentUser } from '../../core/auth.ts';
import { validQuery } from '../../core/validate.ts';
import * as messages from './messages.service.ts';

export async function send(req: Request, res: Response) {
  res.status(201).json(await messages.send(currentUser(req), req.body));
}

export async function history(req: Request, res: Response) {
  res.json(await messages.history(validQuery(req)));
}
