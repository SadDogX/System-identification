import type { Position, User } from '@prisma/client';
import type { PositionDto, PositionRequest } from '@app/shared';
import { prisma } from '../../core/db.ts';
import { badRequest, conflict, notFound } from '../../core/errors.ts';
import { audit, diffOf } from '../../core/audit.ts';

type Row = Position & { _count: { users: number }; systemRole: { id: number; code: string; name: string; description: string; isActive: boolean } };

function toDto(position: Row): PositionDto {
  return { id: position.id, name: position.name, systemRole: { ...position.systemRole, code: position.systemRole.code as PositionDto['systemRole']['code'] }, sortOrder: position.sortOrder, isArchived: position.isArchived, usersCount: position._count.users };
}

const includeDetails = { _count: { select: { users: { where: { isDeleted: false } } } }, systemRole: { select: { id: true, code: true, name: true, description: true, isActive: true } } } as const;

export async function list(includeArchived: boolean): Promise<PositionDto[]> {
  const rows = await prisma.position.findMany({
    where: includeArchived ? {} : { isArchived: false },
    include: includeDetails,
    orderBy: [{ isArchived: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
  });
  return rows.map(toDto);
}

async function assertUniqueName(name: string, exceptId?: number) {
  const same = await prisma.position.findUnique({ where: { name } });
  if (same && same.id !== exceptId) throw conflict('Такая должность уже есть в справочнике');
}

async function assertActiveRole(systemRoleId: number) {
  const role = await prisma.systemRole.findUnique({ where: { id: systemRoleId } });
  if (!role) throw badRequest('Указанная роль не найдена');
  if (!role.isActive) throw badRequest('Нельзя назначить неактивную системную роль');
}

export async function create(actor: User, input: PositionRequest) {
  await assertUniqueName(input.name);
  await assertActiveRole(input.systemRoleId);
  const row = await prisma.$transaction(async (tx) => {
    const created = await tx.position.create({ data: input, include: includeDetails });
    await audit(tx, { actorId: actor.id, action: 'position.create', entityType: 'Position', entityId: created.id, diff: diffOf(null, created, ['name', 'systemRoleId']) });
    return created;
  });
  return toDto(row);
}

export async function update(actor: User, id: number, input: PositionRequest) {
  const existing = await prisma.position.findUnique({ where: { id } });
  if (!existing) throw notFound('Должность не найдена');
  await assertUniqueName(input.name, id);
  await assertActiveRole(input.systemRoleId);
  const row = await prisma.$transaction(async (tx) => {
    const updated = await tx.position.update({ where: { id }, data: input, include: includeDetails });
    await audit(tx, { actorId: actor.id, action: 'position.update', entityType: 'Position', entityId: id, diff: diffOf(existing, updated, ['name', 'sortOrder', 'systemRoleId']) });
    return updated;
  });
  return toDto(row);
}

export async function setArchived(actor: User, id: number, isArchived: boolean) {
  const existing = await prisma.position.findUnique({ where: { id } });
  if (!existing) throw notFound('Должность не найдена');
  const row = await prisma.$transaction(async (tx) => {
    const updated = await tx.position.update({ where: { id }, data: { isArchived }, include: includeDetails });
    await audit(tx, { actorId: actor.id, action: isArchived ? 'position.archive' : 'position.unarchive', entityType: 'Position', entityId: id, diff: diffOf(existing, updated, ['isArchived']) });
    return updated;
  });
  return toDto(row);
}
