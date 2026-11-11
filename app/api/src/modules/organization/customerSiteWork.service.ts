import { prisma, type Tx } from '../../core/db.ts';
import { audit } from '../../core/audit.ts';
import { badRequest, forbidden, notFound } from '../../core/errors.ts';
import type { User } from '@prisma/client';
import type { CustomerSiteWorkInput } from './customerSiteWork.schema.ts';

const dateOnly = (value: string) => new Date(`${value}T00:00:00.000Z`);
const INCLUDE = {
  customer: { select: { id: true, name: true } },
  mine: { select: { id: true, name: true, base: { select: { id: true, name: true } } } },
  well: { select: { id: true, name: true, clusterNumber: true } },
  supervisor: { select: { id: true, user: { select: { fullName: true } } } },
} as const;

async function roles(tx: Tx, userId: number) {
  const rows = await tx.userSystemRole.findMany({
    where: { userId, revokedAt: null, systemRole: { isActive: true } },
    select: { systemRole: { select: { code: true } } },
  });
  const codes = rows.map((row) => row.systemRole.code);
  if (codes.includes('MANAGER') && !codes.includes('COORDINATOR')) codes.push('COORDINATOR');
  return codes;
}
const admin = (user: User, roleCodes: string[]) => roleCodes.includes('ADMIN');

async function permittedMineIds(tx: Tx, employeeId: number) {
  const rows = await tx.mineCoordinatorAssignment.findMany({
    where: { coordinatorId: employeeId, currentMineId: { not: null } },
    select: { mineId: true },
  });
  return rows.map((row) => row.mineId);
}

export async function options(actor: User) {
  const actorRoles = await roles(prisma, actor.id);
  const isAdministrator = admin(actor, actorRoles);
  const isManager = actorRoles.includes('MANAGER');
  if (!isAdministrator && !actorRoles.includes('COORDINATOR')) throw forbidden();
  const employee = await prisma.employee.findUnique({ where: { userId: actor.id } });
  if (!employee && !isAdministrator) throw forbidden();
  const active = employee ? await prisma.employeeAssignment.findUnique({ where: { activeEmployeeId: employee.id }, select: { baseId: true } }) : null;
  const mineIds = employee ? await permittedMineIds(prisma, employee.id) : [];
  const mineWhere = isAdministrator ? {} : isManager ? { baseId: active?.baseId ?? -1 } : { id: { in: mineIds } };
  const supervisorWhere = isAdministrator
    ? { activeEmployeeId: { not: null } }
    : isManager
      ? { activeEmployeeId: { not: null }, baseId: active?.baseId ?? -1 }
      : { activeEmployeeId: { not: null }, supervisorEmployeeId: employee!.id };
  const [customers, mines, supervisors] = await Promise.all([
    prisma.customer.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.mine.findMany({ where: { isActive: true, ...mineWhere }, include: { base: { select: { id: true, name: true } } }, orderBy: { name: 'asc' } }),
    prisma.employee.findMany({ where: { user: { isActive: true, isDeleted: false }, assignments: { some: supervisorWhere } }, select: { id: true, user: { select: { fullName: true } } }, orderBy: { user: { fullName: 'asc' } } }),
  ]);
  return { customers, mines, supervisors };
}

export async function team(actor: User) {
  const actorRoles = await roles(prisma, actor.id);
  const isManager = actorRoles.includes('MANAGER');
  const employee = await prisma.employee.findUnique({ where: { userId: actor.id } });
  if (!actorRoles.includes('COORDINATOR') || !employee) throw forbidden();
  const current = isManager ? await prisma.employeeAssignment.findUnique({ where: { activeEmployeeId: employee.id }, select: { baseId: true } }) : null;
  return prisma.employee.findMany({
    where: { user: { isActive: true, isDeleted: false }, assignments: { some: isManager ? { activeEmployeeId: { not: null }, baseId: current?.baseId ?? -1 } : { activeEmployeeId: { not: null }, supervisorEmployeeId: employee.id } } },
    select: { id: true, user: { select: { fullName: true } } },
    orderBy: { user: { fullName: 'asc' } },
  });
}

export async function list(actor: User) {
  const actorRoles = await roles(prisma, actor.id);
  const isAdministrator = admin(actor, actorRoles);
  if (!isAdministrator && !actorRoles.includes('COORDINATOR')) throw forbidden();
  const employee = await prisma.employee.findUnique({ where: { userId: actor.id } });
  if (!employee && !isAdministrator) throw forbidden();
  const mineIds = employee ? await permittedMineIds(prisma, employee.id) : [];
  const rows = await prisma.customerSiteWork.findMany({
    where: isAdministrator ? {} : { mineId: { in: mineIds } },
    include: INCLUDE,
    orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
  });
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  return rows.map((row) => {
    const hasOverlap = rows.some((other) => other.id !== row.id && other.wellId === row.wellId && other.startsAt <= row.expectedEndAt && other.expectedEndAt >= row.startsAt);
    const status = hasOverlap ? 'OVERLAP' : row.expectedEndAt < today ? 'PAST' : row.startsAt > today ? 'UPCOMING' : 'ACTIVE';
    return { ...row, status, hasOverlap, startsAt: row.startsAt.toISOString().slice(0, 10), expectedEndAt: row.expectedEndAt.toISOString().slice(0, 10) };
  });
}

export async function listExecutions(actor: User, customerSiteWorkId: number) {
  const actorRoles = await roles(prisma, actor.id);
  const isAdministrator = admin(actor, actorRoles);
  if (!isAdministrator && !actorRoles.includes('COORDINATOR')) throw forbidden();
  const employee = await prisma.employee.findUnique({ where: { userId: actor.id } });
  if (!employee && !isAdministrator) throw forbidden();
  const mineIds = employee ? await permittedMineIds(prisma, employee.id) : [];
  const siteWork = await prisma.customerSiteWork.findFirst({
    where: { id: customerSiteWorkId, ...(isAdministrator ? {} : { mineId: { in: mineIds } }) },
    select: { id: true },
  });
  if (!siteWork) throw notFound('Работа на объекте заказчика не найдена');
  const executions = await prisma.workExecution.findMany({
    where: { customerSiteWorkId },
    include: {
      workType: { select: { name: true } },
      status: { select: { name: true } },
      contract: { select: { number: true } },
      addendum: { select: { number: true } },
      responsible: { include: { employee: { select: { user: { select: { fullName: true } } } } } },
    },
    orderBy: [{ performedAt: 'desc' }, { id: 'desc' }],
  });
  return executions.map((execution) => ({
    id: execution.id,
    performedAt: execution.performedAt.toISOString().slice(0, 10),
    workType: execution.workType,
    status: execution.status,
    contract: execution.contract,
    addendum: execution.addendum,
    description: execution.description,
    responsible: execution.responsible.map((item) => item.employee.user.fullName),
  }));
}

export async function create(actor: User, input: CustomerSiteWorkInput) {
  return prisma.$transaction(async (tx) => {
    const actorRoles = await roles(tx, actor.id);
    const isAdministrator = admin(actor, actorRoles);
    if (!isAdministrator && !actorRoles.includes('COORDINATOR')) throw forbidden();
    const employee = await tx.employee.findUnique({ where: { userId: actor.id } });
    if (!employee && !isAdministrator) throw forbidden();
    const mine = await tx.mine.findUnique({ where: { id: input.mineId }, include: { base: true } });
    if (!mine?.isActive || !mine.base.isActive) throw notFound('Месторождение не найдено или архивировано');
    if (!isAdministrator && !(await tx.mineCoordinatorAssignment.findFirst({ where: { coordinatorId: employee!.id, mineId: mine.id, currentMineId: mine.id } }))) throw forbidden();
    const [customer, well, supervisor] = await Promise.all([
      tx.customer.findUnique({ where: { id: input.customerId } }),
      tx.well.findUnique({ where: { id: input.wellId } }),
      tx.employee.findUnique({ where: { id: input.supervisorEmployeeId }, include: { user: { select: { isActive: true, isDeleted: true } }, assignments: { where: { activeEmployeeId: { not: null } }, select: { supervisorEmployeeId: true } } } }),
    ]);
    if (!customer?.isActive) throw badRequest('Выберите активного заказчика');
    if (!well?.isActive || well.mineId !== mine.id || !well.clusterNumber) throw badRequest('Скважина должна относиться к выбранному месторождению и иметь заданный куст');
    if (!supervisor || !supervisor.user.isActive || supervisor.user.isDeleted) throw badRequest('Руководитель не найден или заблокирован');
    if (!isAdministrator && !supervisor.assignments.some((assignment) => assignment.supervisorEmployeeId === employee!.id)) throw badRequest('Руководитель должен быть сотрудником вашей команды');
    const overlap = await tx.customerSiteWork.findMany({
      where: { wellId: well.id, startsAt: { lte: dateOnly(input.expectedEndAt) }, expectedEndAt: { gte: dateOnly(input.startsAt) } },
      select: { id: true, name: true, startsAt: true, expectedEndAt: true },
    });
    const created = await tx.customerSiteWork.create({
      data: {
        name: input.name, customerId: customer.id, mineId: mine.id, clusterNumber: well.clusterNumber!, wellId: well.id,
        startsAt: dateOnly(input.startsAt), expectedEndAt: dateOnly(input.expectedEndAt), supervisorEmployeeId: supervisor.id, createdById: actor.id,
      },
      include: INCLUDE,
    });
    await audit(tx, { actorId: actor.id, action: 'organization.customerSiteWork.create', entityType: 'CustomerSiteWork', entityId: created.id });
    return {
      ...created,
      startsAt: created.startsAt.toISOString().slice(0, 10),
      expectedEndAt: created.expectedEndAt.toISOString().slice(0, 10),
      status: overlap.length ? 'OVERLAP' : new Date(input.expectedEndAt) < new Date(new Date().toISOString().slice(0, 10)) ? 'PAST' : input.startsAt > new Date().toISOString().slice(0, 10) ? 'UPCOMING' : 'ACTIVE',
      hasOverlap: overlap.length > 0,
      conflictingWork: overlap.map((work) => ({ ...work, startsAt: work.startsAt.toISOString().slice(0, 10), expectedEndAt: work.expectedEndAt.toISOString().slice(0, 10) })),
    };
  }, { isolationLevel: 'Serializable' });
}
