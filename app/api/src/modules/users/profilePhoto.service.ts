import { randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { User } from '@prisma/client';
import { config } from '../../core/config.ts';
import { prisma } from '../../core/db.ts';
import { badRequest, notFound } from '../../core/errors.ts';
import { audit } from '../../core/audit.ts';

function detect(body: Buffer): { mime: string; ext: string } | null {
  if (body.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return { mime: 'image/jpeg', ext: 'jpg' };
  if (body.subarray(0, 8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]))) return { mime: 'image/png', ext: 'png' };
  if (body.toString('ascii', 0, 4) === 'RIFF' && body.toString('ascii', 8, 12) === 'WEBP') return { mime: 'image/webp', ext: 'webp' };
  return null;
}
const pathFor = (file: string) => fileURLToPath(new URL(file, config.uploadsDir));
export async function save(actor: User, body: unknown) {
  if (!Buffer.isBuffer(body) || body.length === 0) throw badRequest('Photo file is missing');
  const type = detect(body); if (!type) throw badRequest('Use JPG, PNG, or WebP');
  const file = `user-${actor.id}-${randomUUID()}.${type.ext}`; await mkdir(fileURLToPath(config.uploadsDir), { recursive: true }); await writeFile(pathFor(file), body);
  const old = await prisma.user.findUnique({ where: { id: actor.id }, select: { photoFile: true } });
  await prisma.user.update({ where: { id: actor.id }, data: { photoFile: file, photoMime: type.mime } }); if (old?.photoFile) await rm(pathFor(old.photoFile), { force: true }); return { photoMime: type.mime };
}
export async function get(actor: User) { const row = await prisma.user.findUnique({ where: { id: actor.id }, select: { photoFile: true, photoMime: true } }); if (!row?.photoFile || !row.photoMime) throw notFound('Photo is not uploaded'); return { path: pathFor(row.photoFile), mime: row.photoMime }; }
export async function remove(actor: User) { const row = await prisma.user.findUnique({ where: { id: actor.id }, select: { photoFile: true } }); await prisma.user.update({ where: { id: actor.id }, data: { photoFile: null, photoMime: null } }); if (row?.photoFile) await rm(pathFor(row.photoFile), { force: true }); }
