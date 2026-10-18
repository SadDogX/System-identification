import { randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { User } from '@prisma/client';
import { PHOTO_TYPES } from '@app/shared';
import { config } from '../../core/config.ts';
import { prisma } from '../../core/db.ts';
import { badRequest, notFound } from '../../core/errors.ts';
import { audit } from '../../core/audit.ts';

type PhotoType = (typeof PHOTO_TYPES)[number];

const EXTENSIONS: Record<PhotoType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

/** Тип файла по первым байтам — заголовку Content-Type от клиента не доверяем. */
function detectType(buf: Buffer): PhotoType | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  if (buf.length >= 5 && buf.toString('ascii', 0, 5) === '%PDF-') return 'application/pdf';
  return null;
}

const filePath = (file: string) => fileURLToPath(new URL(file, config.uploadsDir));

export async function deletePhotoFile(file: string | null | undefined) {
  if (file) await rm(filePath(file), { force: true });
}

/**
 * Сотрудник работает только со своими действующими записями,
 * администратор — с записями любого неудалённого сотрудника.
 */
async function findAccessible(actor: User, id: number) {
  const row = await prisma.userCredential.findFirst({
    where:
      actor.role === 'ADMIN'
        ? { id, user: { isDeleted: false } }
        : { id, userId: actor.id, isMarkedForDeletion: false, credential: { isArchived: false } },
  });
  if (!row) throw notFound('Удостоверение не найдено');
  return row;
}

export async function savePhoto(actor: User, id: number, body: unknown) {
  const row = await findAccessible(actor, id);
  if (!Buffer.isBuffer(body) || body.length === 0) throw badRequest('Файл не передан');
  const type = detectType(body);
  if (!type) throw badRequest('Поддерживаются файлы JPG, PNG, WebP или PDF');

  const file = `${id}-${randomUUID()}.${EXTENSIONS[type]}`;
  await mkdir(fileURLToPath(config.uploadsDir), { recursive: true });
  await writeFile(filePath(file), body);
  await prisma.$transaction(async (tx) => {
    await tx.userCredential.update({ where: { id }, data: { photoFile: file, photoMime: type, updatedById: actor.id } });
    await audit(tx, {
      actorId: actor.id,
      action: 'credential.photo',
      entityType: 'UserCredential',
      entityId: id,
      targetUserId: row.userId,
      diff: { photo: { from: row.photoFile ? 'загружено' : null, to: 'загружено' } },
    });
  });
  await deletePhotoFile(row.photoFile);
  return { photoMime: type };
}

export async function getPhoto(actor: User, id: number) {
  const row = await findAccessible(actor, id);
  if (!row.photoFile || !row.photoMime) throw notFound('Фото не загружено');
  return { path: filePath(row.photoFile), mime: row.photoMime };
}

export async function removePhoto(actor: User, id: number) {
  const row = await findAccessible(actor, id);
  if (!row.photoFile) return;
  await prisma.$transaction(async (tx) => {
    await tx.userCredential.update({ where: { id }, data: { photoFile: null, photoMime: null, updatedById: actor.id } });
    await audit(tx, {
      actorId: actor.id,
      action: 'credential.photoDelete',
      entityType: 'UserCredential',
      entityId: id,
      targetUserId: row.userId,
      diff: { photo: { from: 'загружено', to: null } },
    });
  });
  await deletePhotoFile(row.photoFile);
}
