import type { Request, Response } from 'express';
import { currentUser } from '../../core/auth.ts';
import { idParam } from '../../core/validate.ts';
import * as photos from './photos.service.ts';

export async function upload(req: Request, res: Response) {
  res.json(await photos.savePhoto(currentUser(req), idParam(req), req.body));
}

export async function download(req: Request, res: Response) {
  const photo = await photos.getPhoto(currentUser(req), idParam(req));
  res.setHeader('Content-Type', photo.mime);
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Content-Disposition', 'inline');
  res.sendFile(photo.path);
}

export async function remove(req: Request, res: Response) {
  await photos.removePhoto(currentUser(req), idParam(req));
  res.status(204).end();
}
