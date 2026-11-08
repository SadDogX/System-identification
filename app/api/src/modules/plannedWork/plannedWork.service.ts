import { Prisma, type User } from '@prisma/client';
import { addDays } from '@app/shared';
import { audit } from '../../core/audit.ts';
import { prisma, type Tx } from '../../core/db.ts';
import { badRequest, forbidden, notFound } from '../../core/errors.ts';
import { conflictDatesForYear, type ConflictWork } from './conflicts.ts';
import type { PlannedWorkInput } from './plannedWork.schema.ts';

const INCLUDE = {
  mine: { select: { id: true, name: true, baseId: true, base: { select: { id: true, name: true } } } },
  well: { select: { id: true, name: true } },
  coordinator: { select: { id: true, user: { select: { fullName: true } } } },
  supervisor: { select: { id: true, user: { select: { fullName: true } } } },
  employees: { include: { employee: { select: { id: true, user: { select: { fullName: true } } } } } },
} satisfies Prisma.PlannedWorkInclude;

type Db = Tx | typeof prisma;

async function rolesFor(db: Db, userId: number) {
  const rows = await db.userSystemRole.findMany({ where: { userId, revokedAt: null, systemRole: { isActive: true } }, select: { systemRole: { select: { code: true } } } });
  const roles = rows.map((row) => row.systemRole.code);
  if (roles.includes('MANAGER') && !roles.includes('COORDINATOR')) roles.push('COORDINATOR');
  return roles;
}

const isAdmin = (actor: User, roles: string[]) => roles.includes('ADMIN');
const dateString = (date: Date) => date.toISOString().slice(0, 10);

async function employeeBase(db: Db, employeeId: number) {
  const assignment = await db.employeeAssignment.findUnique({ where: { activeEmployeeId: employeeId }, select: { baseId: true } });
  return assignment?.baseId ?? null;
}

async function authorizedBaseIds(db: Db, actor: User, roles: string[], employeeId: number | null) {
  if (isAdmin(actor, roles)) return (await db.base.findMany({ where: { isActive: true }, select: { id: true } })).map((row) => row.id);
  if (!employeeId) return [];
  const ids = new Set<number>();
  if (roles.includes('MANAGER') || !roles.includes('COORDINATOR')) {
    const baseId = await employeeBase(db, employeeId);
    if (baseId !== null) ids.add(baseId);
  }
  if (roles.includes('COORDINATOR')) {
    const assignments = await db.mineCoordinatorAssignment.findMany({
      where: { coordinatorId: employeeId, currentMineId: { not: null } },
      select: { mine: { select: { baseId: true } } },
    });
    assignments.forEach((assignment) => ids.add(assignment.mine.baseId));
  }
  return [...ids];
}

async function accessContext(db: Db, actor: User) {
  const roles = await rolesFor(db, actor.id);
  const admin = isAdmin(actor, roles);
  const employee = await db.employee.findUnique({ where: { userId: actor.id }, select: { id: true } });
  if (!admin && !employee) throw forbidden();
  return { roles, admin, employeeId: employee?.id ?? null, baseIds: await authorizedBaseIds(db, actor, roles, employee?.id ?? null) };
}

function serialized(row: Prisma.PlannedWorkGetPayload<{ include: typeof INCLUDE }>) {
  return { ...row, startsAt: dateString(row.startsAt), endsAt: dateString(row.endsAt) };
}

function withinYearQuery(year: number): Prisma.PlannedWorkWhereInput {
  return { startsAt: { lt: new Date(Date.UTC(year + 1, 0, 1)) }, endsAt: { gte: new Date(Date.UTC(year, 0, 1)) } };
}

export async function list(actor: User, year: number) {
  return listVisible(actor, year);
}

export async function listVisible(actor: User, year: number) {
  const { roles, admin, employeeId, baseIds } = await accessContext(prisma, actor);
  if (!baseIds.length) return { year, rows: [] };
  const range = { startsAt: { lt: new Date(Date.UTC(year + 1, 0, 1)) }, endsAt: { gte: new Date(Date.UTC(year, 0, 1)) } };
  const allForConflicts = await prisma.plannedWork.findMany({ where: { baseId: { in: baseIds }, ...range }, select: { id: true, baseId: true, mineId: true, clusterNumber: true, startsAt: true, endsAt: true } });
  const conflicts = new Map<number, Set<string>>();
  for (const baseId of baseIds) {
    const scoped: ConflictWork[] = allForConflicts.filter((row) => row.baseId === baseId).map((row) => ({ id: row.id, mineId: row.mineId, clusterNumber: row.clusterNumber, startsAt: dateString(row.startsAt), endsAt: dateString(row.endsAt) }));
    conflictDatesForYear(scoped, year).forEach((dates, id) => conflicts.set(id, dates));
  }
  const visibleWhere: Prisma.PlannedWorkWhereInput = admin || roles.includes('MANAGER')
    ? { baseId: { in: baseIds }, ...range }
    : roles.includes('COORDINATOR')
      ? { baseId: { in: baseIds }, coordinatorEmployeeId: employeeId!, ...range }
      : { baseId: { in: baseIds }, employees: { some: { employeeId: employeeId! } }, ...range };
  const rows = await prisma.plannedWork.findMany({ where: visibleWhere, include: INCLUDE, orderBy: [{ mineId: 'asc' }, { clusterNumber: 'asc' }, { startsAt: 'asc' }, { id: 'asc' }] });
  return { year, rows: rows.map((row) => {
    const startsAt = dateString(row.startsAt); const endsAt = dateString(row.endsAt); const conflictDates = conflicts.get(row.id) ?? new Set<string>();
    return { ...serialized(row), conflictDates: [...conflictDates], segments: splitSegments({ startsAt, endsAt }, conflictDates, year) };
  }) };
}

function splitSegments(work: { startsAt: string; endsAt: string }, conflictDates: Set<string>, year: number) {
  const start = work.startsAt < `${year}-01-01` ? `${year}-01-01` : work.startsAt;
  const end = work.endsAt > `${year}-12-31` ? `${year}-12-31` : work.endsAt;
  if (start > end) return [];
  const segments: { startsAt: string; endsAt: string; conflict: boolean }[] = [];
  let segmentStart = start;
  let conflict = conflictDates.has(start);
  for (let date = addDays(start, 1); date <= end; date = addDays(date, 1)) {
    const next = conflictDates.has(date);
    if (next !== conflict) {
      segments.push({ startsAt: segmentStart, endsAt: addDays(date, -1), conflict });
      segmentStart = date;
      conflict = next;
    }
  }
  segments.push({ startsAt: segmentStart, endsAt: end, conflict });
  return segments;
}

export async function getOptions(actor: User) {
  const { roles, admin, employeeId, baseIds } = await accessContext(prisma, actor);
  if (!admin && !roles.includes('MANAGER') && !roles.includes('COORDINATOR')) throw forbidden();
  const mines = await prisma.mine.findMany({ where: { isActive: true, baseId: { in: baseIds }, ...(!admin && !roles.includes('MANAGER') && employeeId !== null && { coordinatorAssignments: { some: { coordinatorId: employeeId, currentMineId: { not: null } } } }) }, select: { id: true, name: true, baseId: true, base: { select: { name: true } } }, orderBy: [{ baseId: 'asc' }, { name: 'asc' }] });
  const staff = await prisma.employee.findMany({ where: { user: { isActive: true, isDeleted: false }, assignments: { some: { activeEmployeeId: { not: null }, baseId: { in: baseIds }, track: 'TRS' } } }, select: { id: true, user: { select: { fullName: true, systemRoles: { where: { revokedAt: null, systemRole: { isActive: true } }, select: { systemRole: { select: { code: true } } } } } }, assignments: { where: { activeEmployeeId: { not: null } }, select: { baseId: true } } }, orderBy: { user: { fullName: 'asc' } } });
  const coordinatorMines = await prisma.mineCoordinatorAssignment.findMany({ where: { currentMineId: { not: null }, mine: { baseId: { in: baseIds } } }, select: { mineId: true, coordinatorId: true } });
  return {
    mines,
    coordinators: staff.filter((item) => item.user.systemRoles.some((grant) => grant.systemRole.code === 'COORDINATOR')).map((item) => ({ id: item.id, fullName: item.user.fullName, baseIds: item.assignments.map((assignment) => assignment.baseId).filter((id): id is number => id !== null), mineIds: coordinatorMines.filter((grant) => grant.coordinatorId === item.id).map((grant) => grant.mineId) })),
    employees: staff.map((item) => ({ id: item.id, fullName: item.user.fullName, baseIds: item.assignments.map((assignment) => assignment.baseId).filter((id): id is number => id !== null) })),
    selfEmployeeId: employeeId,
  };
}

async function validateInput(tx: Tx, actor: User, input: PlannedWorkInput) {
  if (input.endsAt < input.startsAt) throw badRequest('Planned end date must not precede start date');
  const { roles, admin, employeeId, baseIds } = await accessContext(tx, actor);
  if (!admin && !roles.includes('MANAGER') && !roles.includes('COORDINATOR')) throw forbidden();
  const mine = await tx.mine.findUnique({ where: { id: input.mineId }, include: { base: true } });
  if (!mine?.isActive || !mine.base.isActive || !baseIds.includes(mine.baseId)) throw badRequest('Selected field is not in your permitted BPO scope');
  if (!admin && !roles.includes('MANAGER')) {
    const assignedMine = await tx.mineCoordinatorAssignment.findFirst({ where: { mineId: mine.id, coordinatorId: employeeId!, currentMineId: mine.id } });
    if (!assignedMine) throw forbidden();
  }
  const well = await tx.well.findFirst({ where: { id: input.wellId, mineId: mine.id, clusterNumber: input.clusterNumber, isActive: true }, select: { id: true } });
  if (!well) throw badRequest('Well must belong to the selected field and pad');
  const activeTrs = { activeEmployeeId: { not: null }, baseId: mine.baseId, track: 'TRS' as const };
  const [coordinator, supervisor, employees] = await Promise.all([
    tx.employee.findFirst({ where: { id: input.coordinatorEmployeeId, assignments: { some: activeTrs }, user: { isActive: true, isDeleted: false, systemRoles: { some: { revokedAt: null, systemRole: { isActive: true, code: 'COORDINATOR' } } } } }, select: { id: true } }),
    tx.employee.findFirst({ where: { id: input.supervisorEmployeeId, assignments: { some: activeTrs }, user: { isActive: true, isDeleted: false } }, select: { id: true } }),
    tx.employee.findMany({ where: { id: { in: [...new Set(input.employeeIds)] }, assignments: { some: activeTrs }, user: { isActive: true, isDeleted: false } }, select: { id: true } }),
  ]);
  const coordinatorMine = await tx.mineCoordinatorAssignment.findFirst({ where: { mineId: mine.id, currentMineId: mine.id, coordinatorId: input.coordinatorEmployeeId } });
  if (!coordinator) throw badRequest('Coordinator must have an active Coordinator role and TRS assignment in this BPO');
  if (!coordinatorMine) throw badRequest('Coordinator must be actively assigned to the selected field');
  if (!supervisor) throw badRequest('Supervisor must have an active TRS assignment in this BPO');
  const employeeIds = [...new Set(input.employeeIds)];
  if (employees.length !== employeeIds.length) throw badRequest('All assigned employees must have active assignments in this BPO');
  if (!employeeIds.includes(supervisor.id)) employeeIds.push(supervisor.id);
  if (!employeeIds.includes(coordinator.id)) employeeIds.push(coordinator.id);
  if (!admin && roles.includes('COORDINATOR') && !roles.includes('MANAGER') && coordinator.id !== employeeId) throw forbidden();
  return { baseId: mine.baseId, mineId: mine.id, wellId: well.id, clusterNumber: input.clusterNumber, name: input.name.trim(), startsAt: new Date(`${input.startsAt}T00:00:00.000Z`), endsAt: new Date(`${input.endsAt}T00:00:00.000Z`), coordinatorEmployeeId: coordinator.id, supervisorEmployeeId: supervisor.id, employeeIds };
}

export async function create(actor: User, input: PlannedWorkInput) {
  return prisma.$transaction(async (tx) => {
    const data = await validateInput(tx, actor, input);
    const { employeeIds, ...work } = data;
    const row = await tx.plannedWork.create({ data: { ...work, createdById: actor.id, employees: { create: employeeIds.map((employeeId) => ({ employeeId })) } }, include: INCLUDE });
    await audit(tx, { actorId: actor.id, action: 'plannedWork.create', entityType: 'PlannedWork', entityId: row.id });
    return serialized(row);
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function getOne(actor: User, id: number) {
  const { roles, admin, employeeId, baseIds } = await accessContext(prisma, actor);
  const row = await prisma.plannedWork.findUnique({ where: { id }, include: INCLUDE });
  if (!row) throw notFound('Planned work not found');
  if (!baseIds.includes(row.baseId) || !(admin || (roles.includes('MANAGER') && baseIds.includes(row.baseId)) || (roles.includes('COORDINATOR') && row.coordinatorEmployeeId === employeeId) || row.employees.some((item) => item.employeeId === employeeId))) throw forbidden();
  return serialized(row);
}

export async function update(actor: User, id: number, input: PlannedWorkInput) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.plannedWork.findUnique({ where: { id } });
    if (!existing) throw notFound('Planned work not found');
    const { roles, admin, employeeId, baseIds } = await accessContext(tx, actor);
    if (!(admin || (roles.includes('MANAGER') && baseIds.includes(existing.baseId)) || (roles.includes('COORDINATOR') && existing.coordinatorEmployeeId === employeeId))) throw forbidden();
    const data = await validateInput(tx, actor, input);
    const { employeeIds, ...work } = data;
    const row = await tx.plannedWork.update({ where: { id }, data: { ...work, employees: { deleteMany: {}, create: employeeIds.map((employeeId) => ({ employeeId })) } }, include: INCLUDE });
    await audit(tx, { actorId: actor.id, action: 'plannedWork.update', entityType: 'PlannedWork', entityId: row.id });
    return serialized(row);
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function remove(actor: User, id: number) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.plannedWork.findUnique({ where: { id } });
    if (!existing) throw notFound('Planned work not found');
    const { roles, admin, employeeId, baseIds } = await accessContext(tx, actor);
    if (!(admin || (roles.includes('MANAGER') && baseIds.includes(existing.baseId)) || (roles.includes('COORDINATOR') && existing.coordinatorEmployeeId === employeeId))) throw forbidden();
    await tx.plannedWork.delete({ where: { id } });
    await audit(tx, { actorId: actor.id, action: 'plannedWork.delete', entityType: 'PlannedWork', entityId: id });
  });
}
