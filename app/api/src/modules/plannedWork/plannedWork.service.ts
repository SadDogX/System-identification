import { Prisma, type User } from '@prisma/client';
import { addDays } from '@app/shared';
import { audit, diffOf } from '../../core/audit.ts';
import { prisma, type Tx } from '../../core/db.ts';
import { badRequest, conflict, forbidden, notFound } from '../../core/errors.ts';
import { conflictDatesForYear, type ConflictWork } from './conflicts.ts';
import type { PlannedWorkInput, PlannedWorkStatusInput } from './plannedWork.schema.ts';

const INCLUDE = {
  base: { select: { id: true, name: true } },
  mine: { select: { id: true, name: true, baseId: true, base: { select: { id: true, name: true } } } },
  well: { select: { id: true, name: true } },
  workType: { select: { id: true, name: true } },
  status: { select: { id: true, code: true, name: true } },
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
  const coordinatorAssignments = !admin && !roles.includes('MANAGER') && roles.includes('COORDINATOR') && employeeId !== null
    ? await prisma.mineCoordinatorAssignment.findMany({ where: { coordinatorId: employeeId, currentMineId: { not: null } }, select: { mineId: true, mine: { select: { baseId: true } } } })
    : [];
  const coordinatedMineIds = coordinatorAssignments.map((assignment) => assignment.mineId);
  const coordinatedBaseIds = [...new Set(coordinatorAssignments.map((assignment) => assignment.mine.baseId))];
  const range = { startsAt: { lt: new Date(Date.UTC(year + 1, 0, 1)) }, endsAt: { gte: new Date(Date.UTC(year, 0, 1)) } };
  const allForConflicts = await prisma.plannedWork.findMany({ where: { baseId: { in: baseIds }, status: { code: { not: 'CANCELLED' } }, ...range }, select: { id: true, baseId: true, mineId: true, locationType: true, wellId: true, clusterNumber: true, startsAt: true, endsAt: true } });
  const conflicts = new Map<number, Set<string>>();
  for (const baseId of baseIds) {
    const scoped: ConflictWork[] = allForConflicts.filter((row) => row.baseId === baseId).map((row) => ({
      id: row.id,
      mineId: row.mineId,
      clusterNumber: row.clusterNumber,
      locationKey: row.locationType === 'BASE'
        ? `BASE:${row.baseId}`
        : row.locationType === 'WELL' && row.wellId !== null
          ? `WELL:${row.wellId}`
          : `CLUSTER:${row.mineId}:${row.clusterNumber}`,
      startsAt: dateString(row.startsAt),
      endsAt: dateString(row.endsAt),
    }));
    conflictDatesForYear(scoped, year).forEach((dates, id) => conflicts.set(id, dates));
  }
  const visibleWhere: Prisma.PlannedWorkWhereInput = admin || roles.includes('MANAGER')
    ? { baseId: { in: baseIds }, ...range }
    : roles.includes('COORDINATOR')
      ? {
        baseId: { in: baseIds },
        OR: [
          { coordinatorEmployeeId: employeeId! },
          ...(coordinatedMineIds.length ? [{ mineId: { in: coordinatedMineIds } }] : []),
          ...(coordinatedBaseIds.length ? [{ baseId: { in: coordinatedBaseIds }, locationType: 'BASE' as const }] : []),
        ],
        ...range,
      }
      : { baseId: { in: baseIds }, employees: { some: { employeeId: employeeId! } }, ...range };
  const rows = await prisma.plannedWork.findMany({ where: visibleWhere, include: INCLUDE, orderBy: [{ mineId: 'asc' }, { clusterNumber: 'asc' }, { startsAt: 'asc' }, { id: 'asc' }] });
  return { year, rows: rows.map((row) => {
    const startsAt = dateString(row.startsAt); const endsAt = dateString(row.endsAt); const conflictDates = conflicts.get(row.id) ?? new Set<string>();
    return { ...serialized(row), conflictDates: [...conflictDates], segments: splitSegments({ startsAt, endsAt }, conflictDates, year) };
  }) };
}

async function canManageWork(db: Db, actor: User, roles: string[], assignment: { baseId: number; mineId: number | null }) {
  if (isAdmin(actor, roles)) return true;
  const employee = await db.employee.findUnique({ where: { userId: actor.id }, select: { id: true } });
  if (!employee) return false;
  if (roles.includes('MANAGER')) return (await employeeBase(db, employee.id)) === assignment.baseId;
  if (!roles.includes('COORDINATOR')) return false;
  const mineAssignment = assignment.mineId !== null
    ? await db.mineCoordinatorAssignment.findFirst({ where: { mineId: assignment.mineId, coordinatorId: employee.id, currentMineId: assignment.mineId }, select: { id: true } })
    : await db.mineCoordinatorAssignment.findFirst({ where: { coordinatorId: employee.id, currentMineId: { not: null }, mine: { baseId: assignment.baseId } }, select: { id: true } });
  return mineAssignment !== null;
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
  const [bases, mines, workTypes, statuses] = await Promise.all([
    prisma.base.findMany({ where: { id: { in: baseIds }, isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.mine.findMany({ where: { isActive: true, baseId: { in: baseIds }, ...(!admin && !roles.includes('MANAGER') && employeeId !== null && { coordinatorAssignments: { some: { coordinatorId: employeeId, currentMineId: { not: null } } } }) }, select: { id: true, name: true, baseId: true, base: { select: { name: true } } }, orderBy: [{ baseId: 'asc' }, { name: 'asc' }] }),
    prisma.workType.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.workStatus.findMany({ where: { isActive: true }, select: { id: true, code: true, name: true }, orderBy: { sortOrder: 'asc' } }),
  ]);
  const staff = await prisma.employee.findMany({ where: { user: { isActive: true, isDeleted: false }, assignments: { some: { activeEmployeeId: { not: null }, baseId: { in: baseIds }, track: 'TRS' } } }, select: { id: true, user: { select: { fullName: true, systemRoles: { where: { revokedAt: null, systemRole: { isActive: true } }, select: { systemRole: { select: { code: true } } } } } }, assignments: { where: { activeEmployeeId: { not: null } }, select: { baseId: true } } }, orderBy: { user: { fullName: 'asc' } } });
  const coordinatorMines = await prisma.mineCoordinatorAssignment.findMany({ where: { currentMineId: { not: null }, mine: { baseId: { in: baseIds } } }, select: { mineId: true, coordinatorId: true } });
  return {
    bases,
    mines,
    coordinators: staff.filter((item) => item.user.systemRoles.some((grant) => grant.systemRole.code === 'COORDINATOR')).map((item) => ({ id: item.id, fullName: item.user.fullName, baseIds: item.assignments.map((assignment) => assignment.baseId).filter((id): id is number => id !== null), mineIds: coordinatorMines.filter((grant) => grant.coordinatorId === item.id).map((grant) => grant.mineId) })),
    employees: staff.map((item) => ({ id: item.id, fullName: item.user.fullName, baseIds: item.assignments.map((assignment) => assignment.baseId).filter((id): id is number => id !== null) })),
    workTypes,
    statuses,
    selfEmployeeId: employeeId,
  };
}

async function validateInput(tx: Tx, actor: User, input: PlannedWorkInput) {
  if (input.endsAt < input.startsAt) throw badRequest('Planned end date must not precede start date');
  const { roles, admin, employeeId, baseIds } = await accessContext(tx, actor);
  if (!admin && !roles.includes('MANAGER') && !roles.includes('COORDINATOR')) throw forbidden();
  const base = await tx.base.findUnique({ where: { id: input.baseId } });
  if (!base?.isActive || !baseIds.includes(base.id)) throw badRequest('Selected BPO is not in your permitted scope');
  let mineId: number | null = null;
  let wellId: number | null = null;
  let clusterNumber: string | null = null;
  let mine: { id: number; baseId: number; isActive: boolean } | null = null;
  if (input.locationType === 'BASE') {
    if (input.mineId || input.wellId || input.clusterNumber) throw badRequest('Base-level work cannot specify a field, pad or well');
  } else {
    mine = input.mineId ? await tx.mine.findUnique({ where: { id: input.mineId } }) : null;
    if (!mine?.isActive || mine.baseId !== base.id) throw badRequest('Selected field does not belong to the selected BPO');
    mineId = mine.id;
    if (!admin && !roles.includes('MANAGER')) {
      const assignedMine = await tx.mineCoordinatorAssignment.findFirst({ where: { mineId: mine.id, coordinatorId: employeeId!, currentMineId: mine.id } });
      if (!assignedMine) throw forbidden();
    }
    if (input.locationType === 'CLUSTER') {
      if (!input.clusterNumber || input.wellId) throw badRequest('Select a pad without selecting a well');
      const clusterExists = await tx.well.findFirst({ where: { mineId: mine.id, clusterNumber: input.clusterNumber, isActive: true }, select: { id: true } });
      if (!clusterExists) throw badRequest('Selected pad does not belong to the selected field');
      clusterNumber = input.clusterNumber;
    } else {
      const well = input.wellId ? await tx.well.findFirst({ where: { id: input.wellId, mineId: mine.id, isActive: true }, select: { id: true, clusterNumber: true } }) : null;
      if (!well) throw badRequest('Selected well does not belong to the selected field');
      wellId = well.id;
      clusterNumber = well.clusterNumber;
    }
  }
  const activeTrs = { activeEmployeeId: { not: null }, baseId: base.id, track: 'TRS' as const };
  const coordinatorUserFilter = input.locationType === 'BASE'
    ? { isActive: true, isDeleted: false }
    : { isActive: true, isDeleted: false, systemRoles: { some: { revokedAt: null, systemRole: { isActive: true, code: 'COORDINATOR' } } } };
  const [coordinator, supervisor, employees] = await Promise.all([
    tx.employee.findFirst({ where: { id: input.coordinatorEmployeeId, assignments: { some: activeTrs }, user: coordinatorUserFilter }, select: { id: true } }),
    tx.employee.findFirst({ where: { id: input.supervisorEmployeeId, assignments: { some: activeTrs }, user: { isActive: true, isDeleted: false } }, select: { id: true } }),
    tx.employee.findMany({ where: { id: { in: [...new Set(input.employeeIds)] }, assignments: { some: activeTrs }, user: { isActive: true, isDeleted: false } }, select: { id: true } }),
  ]);
  if (!coordinator) throw badRequest('Selected coordinator must have an active TRS assignment in this BPO');
  if (input.locationType !== 'BASE') {
    const coordinatorMine = await tx.mineCoordinatorAssignment.findFirst({ where: { mineId: mine!.id, currentMineId: mine!.id, coordinatorId: input.coordinatorEmployeeId } });
    if (!coordinatorMine) throw badRequest('Coordinator must be actively assigned to the selected field');
  }
  if (!supervisor) throw badRequest('Supervisor must have an active TRS assignment in this BPO');
  const employeeIds = [...new Set(input.employeeIds)];
  if (employees.length !== employeeIds.length) throw badRequest('All assigned employees must have active assignments in this BPO');
  if (!employeeIds.includes(supervisor.id)) employeeIds.push(supervisor.id);
  if (!employeeIds.includes(coordinator.id)) employeeIds.push(coordinator.id);
  const leader = await tx.employee.findFirst({ where: { id: { in: employeeIds }, user: { systemRoles: { some: { revokedAt: null, systemRole: { isActive: true, code: { in: ['MANAGER', 'COORDINATOR'] } } } } } }, select: { id: true } });
  if (!leader) throw badRequest('Team must include a manager or coordinator');
  if (!admin && roles.includes('COORDINATOR') && !roles.includes('MANAGER') && input.locationType !== 'BASE' && coordinator.id !== employeeId) throw forbidden();
  const workType = await tx.workType.findFirst({ where: { id: input.workTypeId, isActive: true }, select: { id: true } });
  if (!workType) throw badRequest('Work type is missing, inactive or unavailable');
  const plannedStatus = await tx.workStatus.findFirst({ where: { code: 'PLANNED', isActive: true }, select: { id: true } });
  if (!plannedStatus) throw conflict('Active PLANNED work status is not configured');
  return {
    baseId: base.id,
    mineId,
    wellId,
    locationType: input.locationType,
    clusterNumber,
    workTypeId: workType.id,
    statusId: plannedStatus.id,
    name: input.name.trim(),
    startsAt: new Date(`${input.startsAt}T00:00:00.000Z`),
    endsAt: new Date(`${input.endsAt}T00:00:00.000Z`),
    description: input.description ?? null,
    coordinatorEmployeeId: coordinator.id,
    supervisorEmployeeId: supervisor.id,
    employeeIds,
  };
}

async function assertNoPlannedWorkOverlaps(tx: Tx, employeeIds: number[], startsAt: Date, endsAt: Date, excludeId?: number) {
  const overlap = await tx.plannedWorkEmployee.findFirst({
    where: {
      employeeId: { in: employeeIds },
      plannedWork: {
        ...(excludeId !== undefined && { id: { not: excludeId } }),
        startsAt: { lte: endsAt },
        endsAt: { gte: startsAt },
        status: { code: { not: 'CANCELLED' } },
      },
    },
    include: {
      employee: { include: { user: { select: { fullName: true } } } },
      plannedWork: { select: { startsAt: true, endsAt: true } },
    },
  });
  if (overlap) throw conflict(`${overlap.employee.user.fullName} already has a planned work assignment from ${dateString(overlap.plannedWork.startsAt)} to ${dateString(overlap.plannedWork.endsAt)}`);
}

export async function create(actor: User, input: PlannedWorkInput) {
  return prisma.$transaction(async (tx) => {
    const data = await validateInput(tx, actor, input);
    const { employeeIds, ...work } = data;
    await assertNoPlannedWorkOverlaps(tx, employeeIds, data.startsAt, data.endsAt);
    const row = await tx.plannedWork.create({ data: { ...work, createdById: actor.id, employees: { create: employeeIds.map((employeeId) => ({ employeeId })) } }, include: INCLUDE });
    await audit(tx, { actorId: actor.id, action: 'plannedWork.create', entityType: 'PlannedWork', entityId: row.id });
    return serialized(row);
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function getOne(actor: User, id: number) {
  const { roles, admin, employeeId, baseIds } = await accessContext(prisma, actor);
  const row = await prisma.plannedWork.findUnique({ where: { id }, include: INCLUDE });
  if (!row) throw notFound('Planned work not found');
  if (!baseIds.includes(row.baseId) || !(await canManageWork(prisma, actor, roles, row)) && !row.employees.some((item) => item.employeeId === employeeId)) throw forbidden();
  return serialized(row);
}

export async function update(actor: User, id: number, input: PlannedWorkInput) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.plannedWork.findUnique({ where: { id }, include: { status: { select: { code: true } }, employees: { select: { employeeId: true } } } });
    if (!existing) throw notFound('Planned work not found');
    if (existing.status.code !== 'PLANNED') throw badRequest('Only planned work can be edited');
    const { roles } = await accessContext(tx, actor);
    if (!(await canManageWork(tx, actor, roles, existing))) throw forbidden();
    const data = await validateInput(tx, actor, input);
    const { employeeIds, ...work } = data;
    await assertNoPlannedWorkOverlaps(tx, employeeIds, data.startsAt, data.endsAt, id);
    const row = await tx.plannedWork.update({ where: { id }, data: { ...work, employees: { deleteMany: {}, create: employeeIds.map((employeeId) => ({ employeeId })) } }, include: INCLUDE });
    const diff = diffOf(existing, row, ['name', 'baseId', 'mineId', 'locationType', 'clusterNumber', 'wellId', 'workTypeId', 'startsAt', 'endsAt', 'description', 'coordinatorEmployeeId', 'supervisorEmployeeId']);
    const previousEmployeeIds = existing.employees.map((item) => item.employeeId).sort((a, b) => a - b);
    const nextEmployeeIds = employeeIds.sort((a, b) => a - b);
    if (JSON.stringify(previousEmployeeIds) !== JSON.stringify(nextEmployeeIds)) diff.employeeIds = { from: previousEmployeeIds, to: nextEmployeeIds };
    await audit(tx, { actorId: actor.id, action: 'plannedWork.update', entityType: 'PlannedWork', entityId: row.id, diff });
    return serialized(row);
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function updateStatus(actor: User, id: number, input: PlannedWorkStatusInput) {
  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.plannedWork.findUnique({ where: { id }, include: { status: { select: { code: true } } } });
      if (!existing) throw notFound('Planned work not found');
      const { roles } = await accessContext(tx, actor);
      if (!(await canManageWork(tx, actor, roles, existing))) throw forbidden();
      const allowedTransitions: Record<string, string[]> = {
        PLANNED: ['IN_PROGRESS', 'CANCELLED'],
        IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
      };
      if (!allowedTransitions[existing.status.code]?.includes(input.statusCode)) {
        throw conflict(`Cannot change planned work status from ${existing.status.code} to ${input.statusCode}`);
      }
      const status = await tx.workStatus.findFirst({ where: { code: input.statusCode, isActive: true } });
      if (!status) throw conflict(`Active work status ${input.statusCode} is not configured`);
      const row = await tx.plannedWork.update({ where: { id }, data: { statusId: status.id }, include: INCLUDE });
      await audit(tx, {
        actorId: actor.id,
        action: 'plannedWork.status.update',
        entityType: 'PlannedWork',
        entityId: id,
        diff: { status: { from: existing.status.code, to: status.code } },
      });
      return serialized(row);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
      throw conflict('Organization data changed concurrently; retry the status update');
    }
    throw error;
  }
}

export async function remove(actor: User, id: number) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.plannedWork.findUnique({ where: { id }, include: { status: { select: { code: true } } } });
    if (!existing) throw notFound('Planned work not found');
    if (existing.status.code !== 'PLANNED') throw conflict('Only planned work can be deleted');
    const { roles, admin, employeeId, baseIds } = await accessContext(tx, actor);
    if (!(admin || (roles.includes('MANAGER') && baseIds.includes(existing.baseId)) || (roles.includes('COORDINATOR') && existing.coordinatorEmployeeId === employeeId))) throw forbidden();
    await tx.plannedWork.delete({ where: { id } });
    await audit(tx, { actorId: actor.id, action: 'plannedWork.delete', entityType: 'PlannedWork', entityId: id });
  });
}
