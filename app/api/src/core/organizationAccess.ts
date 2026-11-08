import type { Prisma, User } from '@prisma/client';
import { forbidden } from './errors.ts';
import { prisma } from './db.ts';

export async function systemRoleCodes(userId: number): Promise<string[]> {
  const grants = await prisma.userSystemRole.findMany({
    where: { userId, revokedAt: null, systemRole: { isActive: true } },
    select: { systemRole: { select: { code: true } } },
  });
  return grants.map(({ systemRole }) => systemRole.code);
}

/** User IDs the caller may manage. ADMIN sees all; other roles stay in their active org scope. */
export async function manageableUserIds(actor: User): Promise<number[]> {
  const roles = await systemRoleCodes(actor.id);
  if (roles.includes('ADMIN')) return [];

  const employee = await prisma.employee.findUnique({ where: { userId: actor.id }, select: { id: true } });
  if (!employee) return [actor.id];
  const current = await prisma.employeeAssignment.findUnique({
    where: { activeEmployeeId: employee.id },
    select: { baseId: true },
  });

  let assignmentWhere: Prisma.EmployeeAssignmentWhereInput;
  if (roles.includes('MANAGER') && current?.baseId !== null && current?.baseId !== undefined) {
    assignmentWhere = { activeEmployeeId: { not: null }, baseId: current.baseId };
  } else if (roles.includes('COORDINATOR')) {
    const coordinated = await prisma.mineCoordinatorAssignment.findMany({
      where: { coordinatorId: employee.id, currentMineId: { not: null } },
      select: { mineId: true },
    });
    const mines = coordinated.length
      ? await prisma.mine.findMany({ where: { id: { in: coordinated.map(({ mineId }) => mineId) } }, select: { baseId: true } })
      : [];
    const baseIds = [...new Set(mines.map(({ baseId }) => baseId))];
    assignmentWhere = {
      activeEmployeeId: { not: null },
      OR: [
        { supervisorEmployeeId: employee.id },
        ...(baseIds.length ? [{ baseId: { in: baseIds }, track: 'TRS' as const }] : []),
      ],
    };
  } else if (roles.includes('SENIOR_MECHANIC')) {
    assignmentWhere = { activeEmployeeId: { not: null }, track: 'R_AND_M' };
  } else if (roles.some((role) => ['MECHANIC', 'SHOP_FOREMAN'].includes(role))) {
    assignmentWhere = { activeEmployeeId: { not: null }, supervisorEmployeeId: employee.id };
  } else {
    return [actor.id];
  }

  const reports = await prisma.employee.findMany({
    where: { assignments: { some: assignmentWhere } },
    select: { userId: true },
  });
  return [...new Set([actor.id, ...reports.map(({ userId }) => userId)])];
}

export async function assertManageableUser(actor: User, userId: number): Promise<void> {
  const ids = await manageableUserIds(actor);
  if (ids.length && !ids.includes(userId)) throw forbidden();
}

/** Prisma filter for records owned by the caller or employees in their active reporting scope. */
export async function manageableUserFilter(actor: User): Promise<Prisma.UserWhereInput> {
  const ids = await manageableUserIds(actor);
  return ids.length ? { id: { in: ids } } : {};
}
