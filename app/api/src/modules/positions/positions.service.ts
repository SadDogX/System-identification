import type { Position, User } from '@prisma/client';
import type { PositionDto, PositionRequest } from '@app/shared';
import { prisma } from '../../core/db.ts';
import { conflict, notFound } from '../../core/errors.ts';
import { audit, diffOf } from '../../core/audit.ts';

type Row = Position & { _count: { users: number } };

function toDto(p: Row): PositionDto {
  return { id: p.id, name: p.name, sortOrder: p.sortOrder, isArchived: p.isArchived, usersCount: p._count.users };
}

const countUsers = { _count: { select: { users: { where: { isDeleted: false } } } } } as const;

export async function list(includeArchived: boolean): Promise<PositionDto[]> {
  const rows = await prisma.position.findMany({
    where: includeArchived ? {} : { isArchived: false },
    include: countUsers,
    orderBy: [{ isArchived: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
  });
  return rows.map(toDto);
}

async function assertUniqueName(name: string, exceptId?: number) {
  const same = await prisma.position.findUnique({ where: { name } });
  if (same && same.id !== exceptId) throw conflict('Такая должность уже есть в справочнике');
}

export async function create(actor: User, input: PositionRequest) {
  await assertUniqueName(input.name);
  const row = await prisma.$transaction(async (tx) => {
    const created = await tx.position.create({ data: input, include: countUsers });
    await audit(tx, {
      actorId: actor.id,
      action: 'position.create',
      entityType: 'Position',
      entityId: created.id,
      diff: diffOf(null, created, ['name']),
    });
    return created;
  });
  return toDto(row);
}

export async function update(actor: User, id: number, input: PositionRequest) {
  const existing = await prisma.position.findUnique({ where: { id } });
  if (!existing) throw notFound('Должность не найдена');
  await assertUniqueName(input.name, id);
  const row = await prisma.$transaction(async (tx) => {
    const updated = await tx.position.update({ where: { id }, data: input, include: countUsers });
    await audit(tx, {
      actorId: actor.id,
      action: 'position.update',
      entityType: 'Position',
      entityId: id,
      diff: diffOf(existing, updated, ['name', 'sortOrder']),
    });
    return updated;
  });
  return toDto(row);
}

/** Архивная должность не предлагается при выборе, но остаётся у тех, кому уже назначена. */
export async function setArchived(actor: User, id: number, isArchived: boolean) {
  const existing = await prisma.position.findUnique({ where: { id } });
  if (!existing) throw notFound('Должность не найдена');
  const row = await prisma.$transaction(async (tx) => {
    const updated = await tx.position.update({ where: { id }, data: { isArchived }, include: countUsers });
    await audit(tx, {
      actorId: actor.id,
      action: isArchived ? 'position.archive' : 'position.unarchive',
      entityType: 'Position',
      entityId: id,
      diff: diffOf(existing, updated, ['isArchived']),
    });
    return updated;
  });
  return toDto(row);
}
