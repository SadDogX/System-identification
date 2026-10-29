import { randomUUID } from 'node:crypto';
import { Prisma, type PrismaClient, type User } from '@prisma/client';
import { todayInTimezone } from '@app/shared';
import type { Tx } from '../../core/db.ts';
import { prisma } from '../../core/db.ts';
import { badRequest, conflict, forbidden, notFound } from '../../core/errors.ts';
import { audit, diffOf } from '../../core/audit.ts';
import type {
  AccountRolesInput,
  AddendumInput,
  AssignmentInput,
  BaseInput,
  BaseUpdateInput,
  ContractInput,
  ContractPermissionInput,
  CustomerInput,
  CustomerUpdateInput,
  EmployeeProfileInput,
  MineCoordinatorInput,
  MineInput,
  StatusCatalogInput,
  StatusCatalogUpdateInput,
  WellInput,
  WellContractBasisInput,
  WorkAuthorizationInput,
  WorkExecutionInput,
  WorkAssignmentInput,
  WorkAssignmentStatusInput,
  WorkTypeInput,
  WorkTypeUpdateInput,
} from './schemas.ts';

const ORG_ROLES = [
  ['ADMIN', 'Администратор'],
  ['MANAGER', 'Менеджер (root)'],
  ['COORDINATOR', 'Координатор (editor)'],
  ['SENIOR_MECHANIC', 'Старший механик'],
  ['MECHANIC', 'Механик'],
  ['SHOP_FOREMAN', 'Мастер цеха'],
  ['SHOP_EMPLOYEE', 'Сотрудник цеха'],
  ['EMPLOYEE', 'Сотрудник'],
] as const;
const EXCLUSIVE_ORG_ROLES = [
  'MANAGER',
  'COORDINATOR',
  'SENIOR_MECHANIC',
  'MECHANIC',
  'SHOP_FOREMAN',
  'SHOP_EMPLOYEE',
] as const;

const INITIAL_BASES = [
  { name: 'Нижневартовск', code: 'NZV_BPO' },
  { name: 'Астрахань', code: 'ASTR_BPO' },
] as const;

const INITIAL_POSITIONS = [
  'Координатор',
  'Техник по бурению 3 категории',
  'Техник по бурению 2 категории',
  'Техник по бурению 1 категории',
  'Инженер по бурению 3 категории',
  'Инженер по бурению 2 категории',
  'Инженер по бурению 1 категории',
  'Инженер по бурению',
  'Руководитель группы',
  'Старший инженер по бурению',
  'Старший механик',
  'Механик',
  'Мастер цеха',
  'Слесарь',
  'Менеджер БПО',
] as const;

const INITIAL_WORK_TYPES = [
  { code: 'CASING_RUN', name: 'Спуск ОК' },
  { code: 'LINER_RUN', name: 'Спуск хвостовика' },
  { code: 'COMPLETION', name: 'Заканчивание' },
] as const;

const ASSIGNMENT_STATUSES = [
  ['ACTIVE', 'Действующее', 1],
  ['CLOSED', 'Закрыто', 2],
  ['TRANSFERRED', 'Переведено', 3],
] as const;

const WORKFLOW_STATUSES = {
  contract: [
    ['DRAFT', 'Черновик', false, 1],
    ['ACTIVE', 'Действует', true, 2],
    ['CLOSED', 'Закрыт', false, 3],
  ],
  addendum: [
    ['DRAFT', 'Черновик', false, 1],
    ['ACTIVE', 'Действует', true, 2],
    ['CLOSED', 'Закрыто', false, 3],
  ],
  work: [
    ['PLANNED', 'Запланирована', 1],
    ['IN_PROGRESS', 'Выполняется', 2],
    ['COMPLETED', 'Завершена', 3],
    ['CANCELLED', 'Отменена', 4],
  ],
} as const;

const today = () => todayInTimezone('Europe/Moscow');
const dateOnly = (value: string) => new Date(`${value}T00:00:00.000Z`);

export async function initializeOrganizationCatalog() {
  await Promise.all([
    ...ORG_ROLES.map(([code, name]) =>
      prisma.systemRole.upsert({ where: { code }, update: {}, create: { code, name } }),
    ),
    ...ASSIGNMENT_STATUSES.map(([code, name, sortOrder]) =>
      prisma.assignmentStatus.upsert({ where: { code }, update: {}, create: { code, name, sortOrder } }),
    ),
    ...WORKFLOW_STATUSES.contract.map(([code, name, allowsWork, sortOrder]) =>
      prisma.contractStatus.upsert({ where: { code }, update: {}, create: { code, name, allowsWork, sortOrder } }),
    ),
    ...WORKFLOW_STATUSES.addendum.map(([code, name, allowsWork, sortOrder]) =>
      prisma.addendumStatus.upsert({ where: { code }, update: {}, create: { code, name, allowsWork, sortOrder } }),
    ),
    ...WORKFLOW_STATUSES.work.map(([code, name, sortOrder]) =>
      prisma.workStatus.upsert({ where: { code }, update: {}, create: { code, name, sortOrder } }),
    ),
    ...INITIAL_BASES.map(({ name, code }) =>
      prisma.base.upsert({ where: { code }, update: {}, create: { name, code } }),
    ),
    ...INITIAL_POSITIONS.map((name, sortOrder) =>
      prisma.position.upsert({ where: { name }, update: {}, create: { name, sortOrder: sortOrder + 1 } }),
    ),
    ...INITIAL_WORK_TYPES.map(({ code, name }) =>
      prisma.workType.upsert({ where: { code }, update: {}, create: { code, name, requiresContractPermission: true } }),
    ),
  ]);
}

export async function ensureEmployeeAndLegacyRole(tx: Tx, user: User, actorId?: number) {
  const employee =
    (await tx.employee.findUnique({ where: { userId: user.id } })) ??
    (await tx.employee.create({ data: { userId: user.id } }));

  const activeAssignment = await tx.employeeAssignment.findUnique({ where: { activeEmployeeId: employee.id } });
  if (!activeAssignment) {
    const activeStatus = await tx.assignmentStatus.findUnique({ where: { code: 'ACTIVE' } });
    if (!activeStatus?.isActive) throw conflict('Не настроен активный статус назначения');
    await tx.employeeAssignment.create({
      data: {
        employeeId: employee.id,
        positionId: user.positionId,
        statusId: activeStatus.id,
        track: 'UNASSIGNED',
        startsAt: dateOnly(today()),
        activeEmployeeId: employee.id,
        operationId: randomUUID(),
        createdById: actorId ?? null,
        reason: 'Создано вместе с учётной записью; оргструктура требует назначения',
      },
    });
  }

  const roleCode = user.role === 'ADMIN' ? 'ADMIN' : 'EMPLOYEE';
  const role = await tx.systemRole.findUnique({ where: { code: roleCode } });
  if (!role?.isActive) throw conflict(`Не настроена системная роль ${roleCode}`);
  const existingGrant = await tx.userSystemRole.findFirst({
    where: { userId: user.id, systemRoleId: role.id, revokedAt: null },
  });
  if (!existingGrant) {
    await tx.userSystemRole.create({
      data: {
        userId: user.id,
        systemRoleId: role.id,
        currentUserRoleKey: `${user.id}:${role.id}`,
        assignedById: actorId ?? null,
      },
    });
  }
  return employee;
}

export async function syncLegacySystemRole(tx: Tx, user: User, actorId: number) {
  const replacementCode = user.role === 'ADMIN' ? 'ADMIN' : 'EMPLOYEE';
  const replacements = await tx.systemRole.findMany({ where: { code: { in: ['ADMIN', 'EMPLOYEE'] } } });
  const activeGrants = await tx.userSystemRole.findMany({
    where: { userId: user.id, revokedAt: null, systemRoleId: { in: replacements.map((role) => role.id) } },
  });
  const replacement = replacements.find((role) => role.code === replacementCode);
  if (!replacement?.isActive) throw conflict(`Не настроена системная роль ${replacementCode}`);
  const currentReplacement = activeGrants.find((grant) => grant.systemRoleId === replacement.id);
  if (activeGrants.length === 1 && currentReplacement) return;

  const now = new Date();
  for (const grant of activeGrants) {
    await tx.userSystemRole.update({
      where: { id: grant.id },
      data: { currentUserRoleKey: null, globalRoleKey: null, revokedAt: now },
    });
  }
  await tx.userSystemRole.create({
    data: {
      userId: user.id,
      systemRoleId: replacement.id,
      currentUserRoleKey: `${user.id}:${replacement.id}`,
      assignedById: actorId,
    },
  });
}

export async function updateEmployeePosition(tx: Tx, user: User, positionId: number | null, actorId: number) {
  const employee = await ensureEmployeeAndLegacyRole(tx, user, actorId);
  const existing = await currentAssignment(tx, employee.id);
  if (!existing) throw conflict('У сотрудника нет действующего назначения');
  if (existing.positionId === positionId) return;

  const operationId = randomUUID();
  if (existing.startsAt.toISOString().slice(0, 10) === today()) {
    await tx.employeeAssignment.update({ where: { id: existing.id }, data: { positionId } });
  } else {
    const closedStatus = await tx.assignmentStatus.findUnique({ where: { code: 'CLOSED' } });
    const activeStatus = await tx.assignmentStatus.findUnique({ where: { code: 'ACTIVE' } });
    if (!closedStatus || !activeStatus?.isActive) throw conflict('Не настроены статусы назначения');
    await tx.employeeAssignment.update({
      where: { id: existing.id },
      data: { endsAt: previousDay(today()), activeEmployeeId: null, statusId: closedStatus.id },
    });
    await tx.employeeAssignment.create({
      data: {
        employeeId: employee.id,
        positionId,
        baseId: existing.baseId,
        supervisorEmployeeId: existing.supervisorEmployeeId,
        statusId: activeStatus.id,
        track: existing.track,
        startsAt: dateOnly(today()),
        activeEmployeeId: employee.id,
        reason: 'Изменение должности через совместимый API пользователей',
        operationId,
        createdById: actorId,
      },
    });
  }
  await tx.organizationChange.create({
    data: {
      employeeId: employee.id,
      actorId,
      action: 'employee.position.update',
      previous: { positionId: existing.positionId },
      next: { positionId },
      reason: 'Изменение должности через совместимый API пользователей',
      operationId,
    },
  });
}

type Database = Tx | PrismaClient;

async function roleCodes(tx: Database, userId: number) {
  const grants = await tx.userSystemRole.findMany({
    where: { userId, revokedAt: null, systemRole: { isActive: true } },
    select: { systemRole: { select: { code: true } } },
  });
  return grants.map((grant) => grant.systemRole.code);
}

async function hasSystemRole(tx: Tx, userId: number, code: string) {
  return (await roleCodes(tx, userId)).includes(code);
}

function isAdministrator(actor: User, roles: string[]) {
  return actor.role === 'ADMIN' || roles.includes('ADMIN');
}

async function actorBase(tx: Database, actor: User) {
  const employee = await tx.employee.findUnique({ where: { userId: actor.id } });
  if (!employee) return null;
  const assignment = await tx.employeeAssignment.findUnique({ where: { activeEmployeeId: employee.id } });
  return assignment?.baseId ?? null;
}

async function assertBaseAccess(tx: Database, actor: User, baseId: number, actorRoles?: string[]) {
  const roles = actorRoles ?? (await roleCodes(tx, actor.id));
  if (isAdministrator(actor, roles)) return;
  if (!roles.includes('MANAGER') || (await actorBase(tx, actor)) !== baseId) throw forbidden();
}

async function canViewEmployee(actor: User, employee: { id: number; assignments?: { baseId: number | null; supervisorEmployeeId: number | null; activeEmployeeId: number | null }[] }) {
  const roles = await roleCodes(prisma, actor.id);
  if (isAdministrator(actor, roles)) return true;
  const actorEmployee = await prisma.employee.findUnique({ where: { userId: actor.id }, select: { id: true } });
  if (actorEmployee?.id === employee.id) return true;
  const active = employee.assignments?.find((assignment) => assignment.activeEmployeeId !== null);
  const scope = await actorBase(prisma, actor);
  if (roles.includes('MANAGER') && scope !== null && active?.baseId === scope) return true;
  if (roles.includes('COORDINATOR')) {
    if (actorEmployee && active?.supervisorEmployeeId === actorEmployee.id) return true;
  }
  return false;
}

export async function listBases(actor: User) {
  const roles = await roleCodes(prisma, actor.id);
  const where =
    isAdministrator(actor, roles) ? {} : roles.includes('MANAGER') ? { id: (await actorBase(prisma, actor)) ?? -1 } : { id: -1 };
  return prisma.base.findMany({ where, orderBy: { name: 'asc' } });
}

export async function listEmployees(actor: User) {
  const roles = await roleCodes(prisma, actor.id);
  const employee = await prisma.employee.findUnique({ where: { userId: actor.id } });
  const current = employee ? await currentAssignment(prisma, employee.id) : null;
  let where: Prisma.EmployeeWhereInput = {};
  if (isAdministrator(actor, roles)) {
    where = { user: { isDeleted: false } };
  } else if (roles.includes('MANAGER') && current?.baseId) {
    where = { user: { isDeleted: false }, assignments: { some: { activeEmployeeId: { not: null }, baseId: current.baseId } } };
  } else if (roles.includes('COORDINATOR') && employee) {
    where = { user: { isDeleted: false }, assignments: { some: { activeEmployeeId: { not: null }, supervisorEmployeeId: employee.id } } };
  } else if (roles.includes('SENIOR_MECHANIC') && employee) {
    where = { user: { isDeleted: false }, assignments: { some: { activeEmployeeId: { not: null }, track: 'R_AND_M', supervisorEmployeeId: employee.id } } };
  } else {
    throw forbidden();
  }
  return prisma.employee.findMany({
    where,
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          login: true,
          phone: true,
          email: true,
          isActive: true,
          isDeleted: true,
          systemRoles: { where: { revokedAt: null, systemRole: { isActive: true } }, include: { systemRole: true } },
        },
      },
      assignments: {
        where: { activeEmployeeId: { not: null } },
        include: { position: true, base: true, status: true, supervisor: { include: { user: { select: { fullName: true } } } } },
      },
      mineAssignments: {
        where: { currentMineId: { not: null } },
        include: { mine: { select: { id: true, name: true } } },
      },
    },
    orderBy: { user: { fullName: 'asc' } },
  });
}

export async function listMines(actor: User, baseId?: number) {
  const roles = await roleCodes(prisma, actor.id);
  if (isAdministrator(actor, roles)) {
    return prisma.mine.findMany({
      where: { ...(baseId && { baseId }) },
      include: { base: true, coordinatorAssignments: { where: { currentMineId: { not: null } }, include: { coordinator: { include: { user: { select: { fullName: true } } } } } } },
      orderBy: [{ baseId: 'asc' }, { name: 'asc' }],
    });
  }
  const employee = await prisma.employee.findUnique({ where: { userId: actor.id } });
  if (roles.includes('MANAGER')) {
    const scope = await actorBase(prisma, actor);
    if (!scope || (baseId !== undefined && baseId !== scope)) throw forbidden();
    return prisma.mine.findMany({ where: { baseId: scope }, include: { base: true, coordinatorAssignments: { where: { currentMineId: { not: null } }, include: { coordinator: { include: { user: { select: { fullName: true } } } } } } }, orderBy: { name: 'asc' } });
  }
  if (roles.includes('COORDINATOR') && employee) {
    return prisma.mine.findMany({
      where: {
        coordinatorAssignments: { some: { coordinatorId: employee.id, currentMineId: { not: null } } },
        ...(baseId && { baseId }),
      },
      include: { base: true, coordinatorAssignments: { where: { currentMineId: { not: null } }, include: { coordinator: { include: { user: { select: { fullName: true } } } } } } },
      orderBy: { name: 'asc' },
    });
  }
  throw forbidden();
}

export async function listWells(actor: User, mineId: number) {
  const mine = await prisma.mine.findUnique({ where: { id: mineId }, include: { base: true } });
  if (!mine?.isActive) throw notFound('Месторождение не найдено или архивировано');
  const roles = await roleCodes(prisma, actor.id);
  if (!isAdministrator(actor, roles)) {
    const employee = await prisma.employee.findUnique({ where: { userId: actor.id } });
    const current = employee ? await currentAssignment(prisma, employee.id) : null;
    const manager = roles.includes('MANAGER') && current?.baseId === mine.baseId;
    const coordinator =
      roles.includes('COORDINATOR') &&
      !!employee &&
      !!(await prisma.mineCoordinatorAssignment.findFirst({
        where: { mineId, coordinatorId: employee.id, currentMineId: mineId },
      }));
    if (!manager && !coordinator) throw forbidden();
  }
  return prisma.well.findMany({
    where: { mineId },
    include: { contractBases: { where: { currentWellId: { not: null } }, include: { contract: true, addendum: true } } },
    orderBy: { name: 'asc' },
  });
}

export async function listContracts(actor: User, baseId: number) {
  await assertBaseAccess(prisma, actor, baseId);
  return prisma.contract.findMany({
    where: { baseId },
    include: { customer: true, base: true, status: true, addenda: { include: { status: true } } },
    orderBy: [{ startsAt: 'desc' }, { number: 'asc' }],
  });
}

export async function listCustomers(actor: User) {
  const roles = await roleCodes(prisma, actor.id);
  if (!isAdministrator(actor, roles) && !roles.includes('MANAGER')) throw forbidden();
  return prisma.customer.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
}

export async function listAdminCustomers() {
  return prisma.customer.findMany({ orderBy: [{ isActive: 'desc' }, { name: 'asc' }] });
}

export async function updateCustomer(actor: User, customerId: number, input: CustomerUpdateInput) {
  const roles = await roleCodes(prisma, actor.id);
  if (!isAdministrator(actor, roles)) throw forbidden();
  return prisma.$transaction(async (tx) => {
    const existing = await tx.customer.findUnique({ where: { id: customerId } });
    if (!existing) throw notFound('Заказчик не найден');
    const updated = await tx.customer.update({ where: { id: customerId }, data: input });
    await audit(tx, { actorId: actor.id, action: 'organization.customer.update', entityType: 'Customer', entityId: customerId, diff: diffOf(existing, updated, ['name', 'code', 'isActive']) });
    return updated;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function listWorkTypes(actor: User) {
  const roles = await roleCodes(prisma, actor.id);
  if (!isAdministrator(actor, roles) && !roles.includes('MANAGER') && !roles.includes('COORDINATOR')) throw forbidden();
  return prisma.workType.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
}

export async function listAdminWorkTypes() {
  return prisma.workType.findMany({ orderBy: [{ isActive: 'desc' }, { name: 'asc' }] });
}

export async function updateWorkType(actor: User, workTypeId: number, input: WorkTypeUpdateInput) {
  const roles = await roleCodes(prisma, actor.id);
  if (!isAdministrator(actor, roles)) throw forbidden();
  return prisma.$transaction(async (tx) => {
    const existing = await tx.workType.findUnique({ where: { id: workTypeId } });
    if (!existing) throw notFound('Вид работ не найден');
    const updated = await tx.workType.update({ where: { id: workTypeId }, data: input });
    await audit(tx, { actorId: actor.id, action: 'organization.workType.update', entityType: 'WorkType', entityId: workTypeId, diff: diffOf(existing, updated, ['name', 'requiresContractPermission', 'isActive']) });
    return updated;
  });
}

export async function createBase(actor: User, input: BaseInput) {
  const roles = await roleCodes(prisma, actor.id);
  if (!isAdministrator(actor, roles)) throw forbidden();
  return prisma.$transaction(async (tx) => {
    const base = await tx.base.create({
      data: { name: input.name, code: input.code ?? null, createdById: actor.id },
    });
    await audit(tx, { actorId: actor.id, action: 'base.create', entityType: 'Base', entityId: base.id });
    return base;
  });
}

export async function updateBase(actor: User, baseId: number, input: BaseUpdateInput) {
  const roles = await roleCodes(prisma, actor.id);
  if (!isAdministrator(actor, roles)) throw forbidden();
  return prisma.$transaction(async (tx) => {
    const existing = await tx.base.findUnique({ where: { id: baseId } });
    if (!existing) throw notFound('База не найдена');
    if (input.isActive === false && existing.isActive) {
      const [assignments, mines, contracts] = await Promise.all([
        tx.employeeAssignment.count({ where: { baseId, activeEmployeeId: { not: null } } }),
        tx.mine.count({ where: { baseId, isActive: true } }),
        tx.contract.count({ where: { baseId, status: { isActive: true, allowsWork: true } } }),
      ]);
      if (assignments || mines || contracts) throw conflict('Нельзя архивировать базу с действующими назначениями, месторождениями или договорами');
    }
    const updated = await tx.base.update({ where: { id: baseId }, data: input });
    await audit(tx, {
      actorId: actor.id,
      action: 'base.update',
      entityType: 'Base',
      entityId: baseId,
      diff: diffOf(existing, updated, ['name', 'code', 'isActive']),
    });
    return updated;
  });
}

export async function createMine(actor: User, baseId: number, input: MineInput) {
  return prisma.$transaction(async (tx) => {
    await assertBaseAccess(tx, actor, baseId);
    const base = await tx.base.findUnique({ where: { id: baseId } });
    if (!base?.isActive) throw notFound('База не найдена или архивирована');
    const mine = await tx.mine.create({
      data: { baseId, name: input.name, code: input.code ?? null, createdById: actor.id },
    });
    await audit(tx, { actorId: actor.id, action: 'mine.create', entityType: 'Mine', entityId: mine.id });
    return mine;
  });
}

export async function createWell(actor: User, mineId: number, input: WellInput) {
  return prisma.$transaction(async (tx) => {
    const mine = await tx.mine.findUnique({ where: { id: mineId } });
    if (!mine?.isActive) throw notFound('Месторождение не найдено или архивировано');
    await assertBaseAccess(tx, actor, mine.baseId);
    const well = await tx.well.create({
      data: { mineId, name: input.name, code: input.code ?? null, clusterNumber: input.clusterNumber ?? null, createdById: actor.id },
    });
    await audit(tx, { actorId: actor.id, action: 'well.create', entityType: 'Well', entityId: well.id });
    return well;
  });
}

export async function listWorkAssignments(actor: User) {
  const roles = await roleCodes(prisma, actor.id);
  let where: Prisma.WorkAssignmentWhereInput;
  if (isAdministrator(actor, roles)) {
    where = {};
  } else {
    const employee = await prisma.employee.findUnique({ where: { userId: actor.id } });
    if (!employee) throw forbidden();
    if (roles.includes('MANAGER')) {
      const baseId = await actorBase(prisma, actor);
      if (!baseId) throw forbidden();
      where = { baseId };
    } else if (roles.includes('COORDINATOR')) {
      const assignments = await prisma.mineCoordinatorAssignment.findMany({
        where: { coordinatorId: employee.id, currentMineId: { not: null } },
        select: { mineId: true, mine: { select: { baseId: true } } },
      });
      const mineIds = assignments.map(({ mineId }) => mineId);
      const baseIds = [...new Set(assignments.map(({ mine }) => mine.baseId))];
      where = {
        OR: [
          ...(mineIds.length ? [{ mineId: { in: mineIds } }] : []),
          ...(baseIds.length ? [{ baseId: { in: baseIds }, locationType: 'BASE' as const }] : []),
        ],
      };
    } else {
      where = { responsible: { some: { employeeId: employee.id } } };
    }
  }
  return prisma.workAssignment.findMany({
    where,
    include: {
      base: { select: { id: true, name: true } },
      mine: { select: { id: true, name: true } },
      well: { select: { id: true, name: true, clusterNumber: true } },
      workType: { select: { id: true, name: true } },
      status: { select: { id: true, code: true, name: true } },
      responsible: {
        include: { employee: { include: { user: { select: { id: true, fullName: true } } } } },
      },
    },
    orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
  });
}

const WORK_ASSIGNMENT_INCLUDE = {
  base: { select: { id: true, name: true } },
  mine: { select: { id: true, name: true } },
  well: { select: { id: true, name: true, clusterNumber: true } },
  workType: { select: { id: true, name: true } },
  status: { select: { id: true, code: true, name: true } },
  responsible: {
    include: { employee: { include: { user: { select: { id: true, fullName: true } } } } },
  },
} satisfies Prisma.WorkAssignmentInclude;

async function prepareWorkAssignment(tx: Tx, actor: User, input: WorkAssignmentInput) {
  const roles = await roleCodes(tx, actor.id);
  const isAdmin = isAdministrator(actor, roles);
  const employee = isAdmin ? null : await tx.employee.findUnique({ where: { userId: actor.id } });
  if (!isAdmin && (!employee || (!roles.includes('MANAGER') && !roles.includes('COORDINATOR')))) {
    throw forbidden();
  }

  const base = await tx.base.findUnique({ where: { id: input.baseId } });
  if (!base?.isActive) throw notFound('База не найдена или архивирована');
  if (!isAdmin && roles.includes('MANAGER') && (await actorBase(tx, actor)) !== input.baseId) {
    throw forbidden();
  }

  let mineId: number | null = null;
  let wellId: number | null = null;
  let clusterNumber: string | null = input.clusterNumber ?? null;
  if (input.locationType !== 'BASE') {
    const mine = input.mineId ? await tx.mine.findUnique({ where: { id: input.mineId } }) : null;
    if (!mine?.isActive || mine.baseId !== input.baseId) throw badRequest('Месторождение не относится к выбранной базе');
    mineId = mine.id;
    if (!isAdmin && roles.includes('COORDINATOR') && !roles.includes('MANAGER')) {
      const coordinatorAssignment = await tx.mineCoordinatorAssignment.findFirst({
        where: { mineId: mine.id, coordinatorId: employee!.id, currentMineId: mine.id },
      });
      if (!coordinatorAssignment) throw forbidden();
    }
  } else if (input.mineId || input.wellId || input.clusterNumber) {
    throw badRequest('Для работы на базе не выбираются месторождение, куст или скважина');
  } else if (!isAdmin && roles.includes('COORDINATOR') && !roles.includes('MANAGER')) {
    const current = await currentAssignment(tx, employee!.id);
    const coordinatedMine = await tx.mineCoordinatorAssignment.findFirst({
      where: { coordinatorId: employee!.id, currentMineId: { not: null }, mine: { baseId: input.baseId } },
    });
    if (current?.baseId !== input.baseId && !coordinatedMine) throw forbidden();
  }

  if (input.locationType === 'WELL') {
    const well = input.wellId ? await tx.well.findUnique({ where: { id: input.wellId } }) : null;
    if (!well?.isActive || well.mineId !== mineId) throw badRequest('Скважина не относится к выбранному месторождению');
    wellId = well.id;
    clusterNumber = well.clusterNumber;
  } else if (input.locationType === 'CLUSTER') {
    const clusterMineId = input.mineId;
    if (!clusterMineId) throw badRequest('Выберите месторождение для работы на кусту');
    const clusterExists = await tx.well.findFirst({
      where: { mineId: clusterMineId, clusterNumber, isActive: true },
      select: { id: true },
    });
    if (!clusterExists) throw badRequest('Выберите куст из справочника скважин месторождения');
  }

  const workType = await tx.workType.findUnique({ where: { id: input.workTypeId } });
  if (!workType?.isActive) throw badRequest('Вид работ не найден или деактивирован');
  const status = await tx.workStatus.findUnique({ where: { code: 'PLANNED' } });
  if (!status?.isActive) throw conflict('Не настроен статус запланированной работы');

  const responsibleIds = [...new Set(input.responsibleEmployeeIds)];
  const responsible = await tx.employee.findMany({
    where: {
      id: { in: responsibleIds },
      user: { isActive: true, isDeleted: false },
      assignments: { some: { activeEmployeeId: { not: null }, baseId: input.baseId } },
    },
    include: {
      user: { select: { systemRoles: { where: { revokedAt: null, systemRole: { isActive: true } }, include: { systemRole: { select: { code: true } } } } } },
    },
  });
  if (responsible.length !== responsibleIds.length) {
    throw badRequest('Все выбранные сотрудники должны иметь действующее назначение на выбранной базе');
  }
  if (!responsible.some((item) => item.user.systemRoles.some((grant) => ['MANAGER', 'COORDINATOR'].includes(grant.systemRole.code)))) {
    throw badRequest('Выберите в команду руководителя или координатора');
  }

  return {
    baseId: input.baseId,
    mineId,
    wellId,
    locationType: input.locationType,
    clusterNumber,
    workTypeId: workType.id,
    statusId: status.id,
    startsAt: dateOnly(input.startsAt),
    endsAt: dateOnly(input.endsAt),
    description: input.description ?? null,
    responsibleIds,
  };
}

async function assertNoWorkAssignmentOverlaps(
  tx: Tx,
  employeeIds: number[],
  startsAt: Date,
  endsAt: Date,
  excludeAssignmentId?: number,
) {
  const overlap = await tx.workAssignmentResponsible.findFirst({
    where: {
      employeeId: { in: employeeIds },
      workAssignment: {
        ...(excludeAssignmentId !== undefined && { id: { not: excludeAssignmentId } }),
        startsAt: { lte: endsAt },
        endsAt: { gte: startsAt },
        status: { code: { not: 'CANCELLED' } },
      },
    },
    include: {
      employee: { include: { user: { select: { fullName: true } } } },
      workAssignment: { select: { startsAt: true, endsAt: true } },
    },
  });
  if (overlap) {
    const starts = overlap.workAssignment.startsAt.toISOString().slice(0, 10);
    const ends = overlap.workAssignment.endsAt.toISOString().slice(0, 10);
    throw conflict(`${overlap.employee.user.fullName} уже назначен на выезд с ${starts} по ${ends}`);
  }
}

async function assertCanManageWorkAssignment(
  tx: Tx,
  actor: User,
  roles: string[],
  assignment: { baseId: number; mineId: number | null },
) {
  if (isAdministrator(actor, roles)) return;
  const employee = await tx.employee.findUnique({ where: { userId: actor.id } });
  if (!employee) throw forbidden();
  if (roles.includes('MANAGER')) {
    if ((await actorBase(tx, actor)) !== assignment.baseId) throw forbidden();
    return;
  }
  if (roles.includes('COORDINATOR')) {
    if (assignment.mineId !== null) {
      const assignedMine = await tx.mineCoordinatorAssignment.findFirst({
        where: { mineId: assignment.mineId, coordinatorId: employee.id, currentMineId: assignment.mineId },
      });
      if (assignedMine) return;
    } else {
      const assignedBase = await tx.mineCoordinatorAssignment.findFirst({
        where: { coordinatorId: employee.id, currentMineId: { not: null }, mine: { baseId: assignment.baseId } },
      });
      if (assignedBase) return;
    }
  }
  throw forbidden();
}

export async function createWorkAssignment(actor: User, input: WorkAssignmentInput) {
  try {
    return await prisma.$transaction(async (tx) => {
      const data = await prepareWorkAssignment(tx, actor, input);
      const { responsibleIds, ...assignmentData } = data;
      await assertNoWorkAssignmentOverlaps(tx, responsibleIds, data.startsAt, data.endsAt);
      const assignment = await tx.workAssignment.create({
        data: {
          ...assignmentData,
          createdById: actor.id,
          responsible: { create: responsibleIds.map((employeeId) => ({ employeeId })) },
        },
        include: WORK_ASSIGNMENT_INCLUDE,
      });
      await audit(tx, {
        actorId: actor.id,
        action: 'organization.workAssignment.create',
        entityType: 'WorkAssignment',
        entityId: assignment.id,
      });
      return assignment;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
      throw conflict('Данные организации изменились параллельно; повторите создание выезда');
    }
    throw error;
  }
}

export async function updateWorkAssignment(actor: User, workAssignmentId: number, input: WorkAssignmentInput) {
  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.workAssignment.findUnique({
        where: { id: workAssignmentId },
        include: { status: { select: { code: true } }, responsible: { select: { employeeId: true } } },
      });
      if (!existing) throw notFound('План выезда не найден');
      if (existing.status.code !== 'PLANNED') throw conflict('Изменять можно только запланированный выезд');
      const roles = await roleCodes(tx, actor.id);
      await assertCanManageWorkAssignment(tx, actor, roles, existing);

      const data = await prepareWorkAssignment(tx, actor, input);
      const { responsibleIds, ...assignmentData } = data;
      await assertNoWorkAssignmentOverlaps(tx, responsibleIds, data.startsAt, data.endsAt, workAssignmentId);
      const updated = await tx.workAssignment.update({
        where: { id: workAssignmentId },
        data: {
          ...assignmentData,
          responsible: {
            deleteMany: {},
            create: responsibleIds.map((employeeId) => ({ employeeId })),
          },
        },
        include: WORK_ASSIGNMENT_INCLUDE,
      });
      const previousResponsibleIds = existing.responsible.map(({ employeeId }) => employeeId).sort((a, b) => a - b);
      const nextResponsibleIds = [...responsibleIds].sort((a, b) => a - b);
      const diff = diffOf(
        existing,
        updated,
        ['baseId', 'mineId', 'wellId', 'locationType', 'clusterNumber', 'workTypeId', 'startsAt', 'endsAt', 'description'],
      );
      if (JSON.stringify(previousResponsibleIds) !== JSON.stringify(nextResponsibleIds)) {
        diff.responsibleEmployeeIds = { from: previousResponsibleIds, to: nextResponsibleIds };
      }
      await audit(tx, {
        actorId: actor.id,
        action: 'organization.workAssignment.update',
        entityType: 'WorkAssignment',
        entityId: updated.id,
        diff,
      });
      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
      throw conflict('Данные организации изменились параллельно; повторите изменение выезда');
    }
    throw error;
  }
}

export async function updateWorkAssignmentStatus(actor: User, workAssignmentId: number, input: WorkAssignmentStatusInput) {
  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.workAssignment.findUnique({
        where: { id: workAssignmentId },
        include: { status: { select: { code: true } } },
      });
      if (!existing) throw notFound('План выезда не найден');
      const roles = await roleCodes(tx, actor.id);
      await assertCanManageWorkAssignment(tx, actor, roles, existing);
      const allowedTransitions: Record<string, string[]> = {
        PLANNED: ['IN_PROGRESS', 'CANCELLED'],
        IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
      };
      if (!allowedTransitions[existing.status.code]?.includes(input.statusCode)) {
        throw conflict(`Нельзя изменить статус выезда с ${existing.status.code} на ${input.statusCode}`);
      }
      const status = await tx.workStatus.findUnique({ where: { code: input.statusCode } });
      if (!status?.isActive) throw conflict(`Не настроен активный статус ${input.statusCode}`);
      const updated = await tx.workAssignment.update({
        where: { id: workAssignmentId },
        data: { statusId: status.id },
        include: WORK_ASSIGNMENT_INCLUDE,
      });
      await audit(tx, {
        actorId: actor.id,
        action: 'organization.workAssignment.status.update',
        entityType: 'WorkAssignment',
        entityId: updated.id,
        diff: { status: { from: existing.status.code, to: status.code } },
      });
      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
      throw conflict('Данные организации изменились параллельно; повторите изменение статуса выезда');
    }
    throw error;
  }
}

export async function updateEmployeeProfile(actor: User, employeeId: number, input: EmployeeProfileInput) {
  return prisma.$transaction(async (tx) => {
    const employee = await tx.employee.findUnique({
      where: { id: employeeId },
      include: { user: true, assignments: { select: { baseId: true, supervisorEmployeeId: true, activeEmployeeId: true } } },
    });
    if (!employee || employee.user.isDeleted) throw notFound('Сотрудник не найден');
    if (!(await canViewEmployee(actor, employee))) throw forbidden();
    const previous = {
      fullName: employee.user.fullName,
      phone: employee.user.phone,
      email: employee.user.email,
    };
    const updated = await tx.user.update({
      where: { id: employee.userId },
      data: { fullName: input.fullName, phone: input.phone ?? null, email: input.email ?? null },
    });
    await audit(tx, {
      actorId: actor.id,
      action: 'organization.employee.profile.update',
      entityType: 'User',
      entityId: updated.id,
      targetUserId: updated.id,
      diff: diffOf(previous, updated, ['fullName', 'phone', 'email']),
    });
    return { id: updated.id, fullName: updated.fullName, phone: updated.phone, email: updated.email };
  });
}

export async function setAccountRoles(actor: User, userId: number, input: AccountRolesInput) {
  const roles = [...new Set(input.roles)];
  if (roles.filter((role) => EXCLUSIVE_ORG_ROLES.includes(role as (typeof EXCLUSIVE_ORG_ROLES)[number])).length > 1) {
    throw badRequest('Одному сотруднику можно назначить только одну управленческую роль оргструктуры');
  }
  try {
    return await prisma.$transaction(async (tx) => {
    const target = await tx.user.findFirst({ where: { id: userId, isDeleted: false } });
    if (!target) throw notFound('Пользователь не найден');
    if (roles.includes('ADMIN') && target.role !== 'ADMIN') {
      throw badRequest('Роль администратора назначается только штатной процедурой управления администраторами');
    }
    const roleRows = await tx.systemRole.findMany({ where: { code: { in: roles }, isActive: true } });
    if (roleRows.length !== roles.length) throw badRequest('Одна или несколько системных ролей неактивны');
    if (roles.includes('SENIOR_MECHANIC') && await tx.userSystemRole.findUnique({ where: { globalRoleKey: 'SENIOR_MECHANIC' } })) {
      const existing = await tx.userSystemRole.findUnique({ where: { currentUserRoleKey: `${userId}:${roleRows.find((role) => role.code === 'SENIOR_MECHANIC')!.id}` } });
      if (!existing) throw conflict('В компании уже назначен старший механик');
    }
    const current = await tx.userSystemRole.findMany({
      where: { userId, revokedAt: null },
      include: { systemRole: { select: { code: true } } },
    });
    const currentCodes = current.map((grant) => grant.systemRole.code);
    const nextCodes = new Set<string>(roles);
    const removed = current.filter((grant) => !nextCodes.has(grant.systemRole.code));
    const currentCodeSet = new Set<string>(currentCodes);
    const added = roleRows.filter((role) => !currentCodeSet.has(role.code));
    if (target.role === 'ADMIN' && !nextCodes.has('ADMIN')) {
      throw badRequest('Роль администратора нельзя снять через системные назначения');
    }
    if (!removed.length && !added.length) return { userId, roles: [...currentCodes].sort() };

    const now = new Date();
    for (const grant of removed) {
      await tx.userSystemRole.update({
        where: { id: grant.id },
        data: { currentUserRoleKey: null, globalRoleKey: null, revokedAt: now },
      });
    }
    for (const role of added) {
      await tx.userSystemRole.create({
        data: {
          userId,
          systemRoleId: role.id,
          currentUserRoleKey: `${userId}:${role.id}`,
          globalRoleKey: role.code === 'SENIOR_MECHANIC' ? 'SENIOR_MECHANIC' : null,
          assignedById: actor.id,
        },
      });
    }
    await tx.user.update({ where: { id: userId }, data: { tokenVersion: { increment: 1 } } });
    const employee = await tx.employee.findUnique({ where: { userId } });
    if (employee) {
      await tx.organizationChange.create({
        data: {
          employeeId: employee.id,
          actorId: actor.id,
          action: 'system_roles.update',
          previous: currentCodes,
          next: roles,
          operationId: randomUUID(),
        },
      });
    }
    await audit(tx, {
      actorId: actor.id,
      action: 'organization.roles.update',
      entityType: 'User',
      entityId: userId,
      targetUserId: userId,
      diff: { roles: { from: currentCodes, to: roles } },
    });
    return { userId, roles: [...roles].sort() };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2002', 'P2034'].includes(error.code)) {
      throw conflict('Системная роль уже назначена или меняется параллельно');
    }
    throw error;
  }
}

type StatusCategory = StatusCatalogInput['category'];

export async function listStatuses(category: StatusCategory) {
  switch (category) {
    case 'assignment':
      return prisma.assignmentStatus.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] });
    case 'contract':
      return prisma.contractStatus.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] });
    case 'addendum':
      return prisma.addendumStatus.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] });
    case 'work':
      return prisma.workStatus.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] });
  }
}

export async function createStatus(actor: User, input: StatusCatalogInput) {
  const common = { code: input.code, name: input.name, sortOrder: input.sortOrder ?? 0 };
  return prisma.$transaction(async (tx) => {
    switch (input.category) {
      case 'assignment':
      {
        const result = await tx.assignmentStatus.create({ data: common });
        await audit(tx, {
          actorId: actor.id,
          action: 'organization.status.create',
          entityType: 'assignmentStatus',
          entityId: result.id,
          diff: { code: { from: null, to: input.code }, name: { from: null, to: input.name } },
        });
        return result;
      }
      case 'contract':
      {
        const result = await tx.contractStatus.create({ data: { ...common, allowsWork: input.allowsWork ?? false } });
        await audit(tx, {
          actorId: actor.id,
          action: 'organization.status.create',
          entityType: 'contractStatus',
          entityId: result.id,
          diff: { code: { from: null, to: input.code }, name: { from: null, to: input.name } },
        });
        return result;
      }
      case 'addendum':
      {
        const result = await tx.addendumStatus.create({ data: { ...common, allowsWork: input.allowsWork ?? false } });
        await audit(tx, {
          actorId: actor.id,
          action: 'organization.status.create',
          entityType: 'addendumStatus',
          entityId: result.id,
          diff: { code: { from: null, to: input.code }, name: { from: null, to: input.name } },
        });
        return result;
      }
      case 'work':
      {
        const result = await tx.workStatus.create({ data: common });
        await audit(tx, {
          actorId: actor.id,
          action: 'organization.status.create',
          entityType: 'workStatus',
          entityId: result.id,
          diff: { code: { from: null, to: input.code }, name: { from: null, to: input.name } },
        });
        return result;
      }
    }
  });
}

export async function updateStatus(actor: User, category: StatusCategory, id: number, input: StatusCatalogUpdateInput) {
  const data = {
    ...(input.name !== undefined && { name: input.name }),
    ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
    ...(input.isActive !== undefined && { isActive: input.isActive }),
  };
  return prisma.$transaction(async (tx) => {
  const recordStatusChange = async (
    before: { name: string; sortOrder: number; isActive: boolean; allowsWork?: boolean },
    after: { name: string; sortOrder: number; isActive: boolean; allowsWork?: boolean },
  ) =>
    audit(tx, {
      actorId: actor.id,
      action: 'organization.status.update',
      entityType: `${category}Status`,
      entityId: id,
      diff: diffOf(before, after, ['name', 'sortOrder', 'isActive', 'allowsWork']),
    });

  switch (category) {
    case 'assignment': {
      const existing = await tx.assignmentStatus.findUnique({ where: { id } });
      if (!existing) throw notFound('Статус назначения не найден');
      if (input.isActive === false && (await tx.employeeAssignment.count({ where: { statusId: id, activeEmployeeId: { not: null } } }))) {
        throw conflict('Нельзя деактивировать статус действующего назначения');
      }
      const updated = await tx.assignmentStatus.update({ where: { id }, data });
      await recordStatusChange(existing, updated);
      return updated;
    }
    case 'contract': {
      const existing = await tx.contractStatus.findUnique({ where: { id } });
      if (!existing) throw notFound('Статус договора не найден');
      const updated = await tx.contractStatus.update({
        where: { id },
        data: { ...data, ...(input.allowsWork !== undefined && { allowsWork: input.allowsWork }) },
      });
      await recordStatusChange(existing, updated);
      return updated;
    }
    case 'addendum': {
      const existing = await tx.addendumStatus.findUnique({ where: { id } });
      if (!existing) throw notFound('Статус дополнительного соглашения не найден');
      const updated = await tx.addendumStatus.update({
        where: { id },
        data: { ...data, ...(input.allowsWork !== undefined && { allowsWork: input.allowsWork }) },
      });
      await recordStatusChange(existing, updated);
      return updated;
    }
    case 'work': {
      const existing = await tx.workStatus.findUnique({ where: { id } });
      if (!existing) throw notFound('Статус выполнения работ не найден');
      const updated = await tx.workStatus.update({ where: { id }, data });
      await recordStatusChange(existing, updated);
      return updated;
    }
  }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

async function currentAssignment(tx: Database, employeeId: number) {
  return tx.employeeAssignment.findUnique({ where: { activeEmployeeId: employeeId } });
}

async function notifyUsers(
  tx: Tx,
  userIds: number[],
  operationId: string,
  title: string,
  body: string,
) {
  for (const userId of [...new Set(userIds)]) {
    await tx.notification.create({
      data: {
        userId,
        kind: 'ORGANIZATION',
        title,
        body,
        dedupKey: `org:${operationId}:${userId}`,
      },
    });
  }
}

const previousDay = (value: string) => {
  const date = dateOnly(value);
  date.setUTCDate(date.getUTCDate() - 1);
  return date;
};

const EXPECTED_SUPERVISOR: Record<string, string> = {
  COORDINATOR: 'MANAGER',
  EMPLOYEE: 'COORDINATOR',
  MECHANIC: 'SENIOR_MECHANIC',
  SHOP_FOREMAN: 'MECHANIC',
  SHOP_EMPLOYEE: 'SHOP_FOREMAN',
};

export async function assignEmployee(actor: User, employeeId: number, input: AssignmentInput) {
  try {
    return await prisma.$transaction(async (tx) => {
      const employee = await tx.employee.findUnique({
        where: { id: employeeId },
        include: { user: { select: { id: true, fullName: true, isActive: true, isDeleted: true } } },
      });
      if (!employee || !employee.user.isActive || employee.user.isDeleted) throw notFound('Сотрудник не найден или заблокирован');

      const roles = await roleCodes(tx, actor.id);
      const administrator = isAdministrator(actor, roles);
      const actorEmployee = await tx.employee.findUnique({ where: { userId: actor.id } });
      const actorAssignment = actorEmployee ? await currentAssignment(tx, actorEmployee.id) : null;
      if (!administrator && (!roles.includes('MANAGER') || !actorAssignment?.baseId)) throw forbidden();

      const employeeRoles = await roleCodes(tx, employee.user.id);
      const expectedRole =
        input.track === 'TRS'
          ? employeeRoles.includes('MANAGER')
            ? 'MANAGER'
            : employeeRoles.includes('COORDINATOR')
              ? 'COORDINATOR'
              : 'EMPLOYEE'
          : employeeRoles.includes('SENIOR_MECHANIC')
            ? 'SENIOR_MECHANIC'
            : employeeRoles.includes('MECHANIC')
              ? 'MECHANIC'
              : employeeRoles.includes('SHOP_FOREMAN')
                ? 'SHOP_FOREMAN'
                : 'SHOP_EMPLOYEE';
      if (
        (input.track === 'TRS' && !['MANAGER', 'COORDINATOR', 'EMPLOYEE'].includes(expectedRole)) ||
        (input.track === 'R_AND_M' && !['SENIOR_MECHANIC', 'MECHANIC', 'SHOP_FOREMAN', 'SHOP_EMPLOYEE'].includes(expectedRole))
      ) {
        throw badRequest('Роль сотрудника не соответствует выбранному подразделению');
      }

      const isSeniorMechanic = expectedRole === 'SENIOR_MECHANIC';
      if (!input.baseId && !isSeniorMechanic) throw badRequest('Для назначения требуется база');
      if (input.startsAt > today()) throw badRequest('Будущие переводы пока не поддерживаются');
      if (!administrator && input.baseId !== actorAssignment?.baseId) throw forbidden();

      if (input.baseId) {
        const base = await tx.base.findUnique({ where: { id: input.baseId } });
        if (!base?.isActive) throw badRequest('База не найдена или архивирована');
      }
      if (input.positionId) {
        const position = await tx.position.findUnique({ where: { id: input.positionId } });
        if (!position || position.isArchived) throw badRequest('Должность не найдена или архивирована');
      }

      let supervisorUserId: number | null = null;
      if (expectedRole === 'SENIOR_MECHANIC' || expectedRole === 'MANAGER') {
        if (input.supervisorEmployeeId) throw badRequest('Для старшей должности непосредственный руководитель не требуется');
      } else {
        const requiredRole = EXPECTED_SUPERVISOR[expectedRole];
        if (!input.supervisorEmployeeId || !requiredRole) throw badRequest('Укажите непосредственного руководителя');
        if (input.supervisorEmployeeId === employeeId) throw badRequest('Сотрудник не может руководить сам собой');
        const supervisor = await tx.employee.findUnique({
          where: { id: input.supervisorEmployeeId },
          include: { user: { select: { id: true, isActive: true, isDeleted: true } } },
        });
        const supervisorAssignment = supervisor ? await currentAssignment(tx, supervisor.id) : null;
        const supervisorRoles = supervisor ? await roleCodes(tx, supervisor.user.id) : [];
        if (
          !supervisor ||
          !supervisor.user.isActive ||
          supervisor.user.isDeleted ||
          !supervisorAssignment ||
          supervisorAssignment.track !== input.track ||
          !supervisorRoles.includes(requiredRole)
        ) {
          throw badRequest('Непосредственный руководитель не соответствует оргструктуре');
        }
        if (input.track === 'TRS' && supervisorAssignment.baseId !== input.baseId) {
          throw badRequest('Руководитель должен быть назначен на ту же базу');
        }
        if (input.track === 'R_AND_M') {
          if (requiredRole === 'SENIOR_MECHANIC') {
            if (supervisorAssignment.baseId !== null) throw badRequest('Старший механик должен иметь межбазовое назначение');
          } else if (supervisorAssignment.baseId !== input.baseId) {
            throw badRequest('Руководитель должен быть назначен на ту же базу');
          }
        }

        const visited = new Set<number>();
        let cursor: number | null = supervisor.id;
        while (cursor !== null && !visited.has(cursor)) {
          if (cursor === employeeId) throw badRequest('Назначение создаёт цикл подчинения');
          visited.add(cursor);
          const parent = await currentAssignment(tx, cursor);
          cursor = parent?.supervisorEmployeeId ?? null;
        }
        if (cursor !== null) throw conflict('Обнаружен существующий цикл подчинения');
        supervisorUserId = supervisor.user.id;
      }

      const existing = await currentAssignment(tx, employeeId);
      const existingStart = existing?.startsAt.toISOString().slice(0, 10);
      const replacingUnassignedPlaceholder = existing?.track === 'UNASSIGNED' && input.startsAt === existingStart;
      if (existing && input.startsAt < existingStart!) {
        throw badRequest('Дата нового назначения должна быть позже текущего');
      }
      if (existing && input.startsAt === existingStart && !replacingUnassignedPlaceholder) {
        throw badRequest('Дата нового назначения должна быть позже текущего');
      }
      if (!administrator && existing?.baseId && existing.baseId !== actorAssignment?.baseId) throw forbidden();

      if (existing && existing.baseId !== input.baseId && employeeRoles.includes('COORDINATOR')) {
        const assignedMines = await tx.mineCoordinatorAssignment.findMany({
          where: { coordinatorId: employeeId, currentMineId: { not: null } },
          include: { mine: { select: { baseId: true } } },
        });
        if (assignedMines.some((assignment) => assignment.mine.baseId !== input.baseId)) {
          throw conflict('Сначала вручную переназначьте месторождения координатора');
        }
      }

      const activeStatus = await tx.assignmentStatus.findUnique({ where: { code: 'ACTIVE' } });
      const transferStatus = await tx.assignmentStatus.findUnique({ where: { code: 'TRANSFERRED' } });
      if (!activeStatus?.isActive || !transferStatus) throw conflict('Не настроены статусы назначения');
      const operationId = randomUUID();
      if (existing && !replacingUnassignedPlaceholder) {
        await tx.employeeAssignment.update({
          where: { id: existing.id },
          data: {
            endsAt: previousDay(input.startsAt),
            activeEmployeeId: null,
            statusId: transferStatus.id,
          },
        });
      }
      const nextData = {
          employeeId,
          positionId: input.positionId === undefined ? existing?.positionId ?? null : input.positionId,
          baseId: input.baseId ?? null,
          supervisorEmployeeId: input.supervisorEmployeeId ?? null,
          statusId: activeStatus.id,
          track: input.track,
          startsAt: dateOnly(input.startsAt),
          activeEmployeeId: employeeId,
          reason: input.reason ?? null,
          operationId,
          createdById: actor.id,
        };
      const next = replacingUnassignedPlaceholder
        ? await tx.employeeAssignment.update({
            where: { id: existing.id },
            data: nextData,
            include: { position: true, base: true, status: true },
          })
        : await tx.employeeAssignment.create({
            data: nextData,
            include: { position: true, base: true, status: true },
          });
      const previousValue = existing
        ? {
            positionId: existing.positionId,
            baseId: existing.baseId,
            supervisorEmployeeId: existing.supervisorEmployeeId,
            track: existing.track,
          }
        : null;
      const isTransfer = !!existing && !replacingUnassignedPlaceholder;
      const nextValue = {
        positionId: next.positionId,
        baseId: next.baseId,
        supervisorEmployeeId: next.supervisorEmployeeId,
        track: next.track,
      };
      await tx.organizationChange.create({
        data: {
          employeeId,
          actorId: actor.id,
          action: isTransfer ? 'employee.transfer' : 'employee.assign',
          previous: previousValue ?? Prisma.JsonNull,
          next: nextValue,
          reason: input.reason ?? null,
          operationId,
        },
      });
      await audit(tx, {
        actorId: actor.id,
        action: isTransfer ? 'organization.employee.transfer' : 'organization.employee.assign',
        entityType: 'EmployeeAssignment',
        entityId: next.id,
        targetUserId: employee.user.id,
        diff: {
          previous: { from: previousValue, to: null },
          next: { from: null, to: nextValue },
          reason: { from: null, to: input.reason ?? null },
        },
      });
      const recipients: number[] = [employee.user.id];
      if (existing?.supervisorEmployeeId) {
        const oldSupervisor = await tx.employee.findUnique({ where: { id: existing.supervisorEmployeeId }, select: { userId: true } });
        if (oldSupervisor) recipients.push(oldSupervisor.userId);
      }
      if (supervisorUserId) recipients.push(supervisorUserId);
      const changedBaseIds = [existing?.baseId, next.baseId].filter((id): id is number => id !== null && id !== undefined);
      if (changedBaseIds.length) {
        const baseManagers = await tx.employeeAssignment.findMany({
          where: {
            activeEmployeeId: { not: null },
            baseId: { in: changedBaseIds },
            employee: {
              user: {
                systemRoles: {
                  some: {
                    revokedAt: null,
                    systemRole: { code: 'MANAGER', isActive: true },
                  },
                },
              },
            },
          },
          select: { employee: { select: { userId: true } } },
        });
        recipients.push(...baseManagers.map(({ employee: baseManager }) => baseManager.userId));
      }
      await notifyUsers(
        tx,
        recipients,
        operationId,
        'Изменение назначения',
        `Для сотрудника ${employee.user.fullName} создано новое назначение${input.reason ? `: ${input.reason}` : '.'}`,
      );
      return { ...next, operationId };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2002', 'P2034'].includes(error.code)) {
      throw conflict('Назначение изменилось параллельно; обновите данные и повторите операцию');
    }
    throw error;
  }
}

export async function assignMineCoordinator(actor: User, mineId: number, input: MineCoordinatorInput) {
  try {
    return await prisma.$transaction(async (tx) => {
      const mine = await tx.mine.findUnique({ where: { id: mineId } });
      if (!mine?.isActive) throw notFound('Месторождение не найдено или архивировано');
      await assertBaseAccess(tx, actor, mine.baseId);

      const coordinator = await tx.employee.findUnique({
        where: { id: input.coordinatorEmployeeId },
        include: { user: { select: { id: true, isActive: true, isDeleted: true } } },
      });
      const assignment = coordinator ? await currentAssignment(tx, coordinator.id) : null;
      if (
        !coordinator ||
        !coordinator.user.isActive ||
        coordinator.user.isDeleted ||
        !assignment ||
        assignment.track !== 'TRS' ||
        assignment.baseId !== mine.baseId ||
        !(await hasSystemRole(tx, coordinator.user.id, 'COORDINATOR'))
      ) {
        throw badRequest('Координатор должен иметь действующее назначение TRS на базу месторождения');
      }
      if (input.startsAt > today()) throw badRequest('Будущие переводы пока не поддерживаются');
      const existing = await tx.mineCoordinatorAssignment.findUnique({ where: { currentMineId: mineId } });
      if (existing && input.startsAt <= existing.startsAt.toISOString().slice(0, 10)) {
        throw badRequest('Дата нового назначения должна быть позже текущего');
      }
      if (existing?.coordinatorId === coordinator.id) throw conflict('Этот координатор уже закреплён за месторождением');

      const operationId = randomUUID();
      if (existing) {
        await tx.mineCoordinatorAssignment.update({
          where: { id: existing.id },
          data: { endsAt: previousDay(input.startsAt), currentMineId: null },
        });
      }
      const next = await tx.mineCoordinatorAssignment.create({
        data: {
          mineId,
          coordinatorId: coordinator.id,
          currentMineId: mineId,
          startsAt: dateOnly(input.startsAt),
          operationId,
          createdById: actor.id,
        },
      });
      await tx.organizationChange.create({
        data: {
          employeeId: coordinator.id,
          actorId: actor.id,
          action: 'mine.coordinator.transfer',
          previous: existing ? { coordinatorEmployeeId: existing.coordinatorId } : Prisma.JsonNull,
          next: { mineId, coordinatorEmployeeId: coordinator.id },
          reason: input.reason ?? null,
          operationId,
        },
      });
      const recipients = [coordinator.user.id];
      if (existing) {
        const previousCoordinator = await tx.employee.findUnique({
          where: { id: existing.coordinatorId },
          select: { userId: true },
        });
        if (previousCoordinator) recipients.push(previousCoordinator.userId);
      }
      await notifyUsers(tx, recipients, operationId, 'Назначен координатор месторождения', `Месторождение «${mine.name}» закреплено за вами.`);
      await audit(tx, {
        actorId: actor.id,
        action: 'organization.mine.coordinator',
        entityType: 'MineCoordinatorAssignment',
        entityId: next.id,
        targetUserId: coordinator.user.id,
        diff: {
          coordinatorEmployeeId: { from: existing?.coordinatorId ?? null, to: coordinator.id },
          reason: { from: null, to: input.reason ?? null },
        },
      });
      return { ...next, operationId };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2002', 'P2034'].includes(error.code)) {
      throw conflict('Назначение координатора изменилось параллельно; обновите данные и повторите операцию');
    }
    throw error;
  }
}

async function checkWorkAuthorization(db: Database, actor: User, input: WorkAuthorizationInput) {
  const performedAt = dateOnly(input.performedAt);
  const well = await db.well.findUnique({
    where: { id: input.wellId },
    include: { mine: { include: { base: true } } },
  });
  if (!well?.isActive || !well.mine.isActive || !well.mine.base.isActive) throw notFound('Скважина не найдена или архивирована');
  const actorRoles = await roleCodes(db, actor.id);
  if (!isAdministrator(actor, actorRoles)) {
    const employee = await db.employee.findUnique({ where: { userId: actor.id } });
    const assignment = employee ? await currentAssignment(db, employee.id) : null;
    const isManager = actorRoles.includes('MANAGER') && assignment?.baseId === well.mine.baseId;
    const isCoordinator =
      actorRoles.includes('COORDINATOR') &&
      !!employee &&
      !!(await db.mineCoordinatorAssignment.findFirst({
        where: { mineId: well.mineId, coordinatorId: employee.id, currentMineId: well.mineId },
      }));
    const isBaseStaff = assignment?.baseId === well.mine.baseId && actorRoles.some((role) => role !== 'ADMIN');
    if (!isManager && !isCoordinator && !isBaseStaff) throw forbidden();
  }

  const workType = await db.workType.findUnique({ where: { id: input.workTypeId } });
  if (!workType?.isActive) throw badRequest('Вид работ не найден или деактивирован');
  const bases = await db.wellContractBasis.findMany({
    where: {
      wellId: well.id,
      startsAt: { lte: performedAt },
      OR: [{ endsAt: null }, { endsAt: { gte: performedAt } }],
    },
    include: {
      contract: { include: { status: true } },
      addendum: { include: { contract: { include: { status: true } }, status: true } },
    },
    take: 2,
  });
  if (bases.length !== 1) return { authorized: false as const, reason: 'На дату выполнения не найдено единственное договорное основание' };

  const basis = bases[0];
  const contract = basis.contract ?? basis.addendum?.contract;
  if (!contract || contract.baseId !== well.mine.baseId) {
    return { authorized: false as const, reason: 'Договор не относится к базе скважины' };
  }
  if (
    performedAt < contract.startsAt ||
    performedAt > contract.endsAt ||
    !contract.status.isActive ||
    !contract.status.allowsWork
  ) {
    return { authorized: false as const, reason: 'Основной договор не разрешает работы на указанную дату' };
  }
  if (basis.addendum) {
    if (
      performedAt < basis.addendum.startsAt ||
      performedAt > basis.addendum.endsAt ||
      !basis.addendum.status.isActive ||
      !basis.addendum.status.allowsWork
    ) {
      return { authorized: false as const, reason: 'Дополнительное соглашение не действует на указанную дату' };
    }
  }
  const contractPermission = await db.contractWorkPermission.findUnique({
    where: { contractId_workTypeId: { contractId: contract.id, workTypeId: workType.id } },
  });
  const addendumPermission = basis.addendum
    ? await db.addendumWorkPermission.findUnique({
        where: { addendumId_workTypeId: { addendumId: basis.addendum.id, workTypeId: workType.id } },
      })
    : null;
  const effectivePermission = addendumPermission?.isAllowed ?? contractPermission?.isAllowed;
  if (effectivePermission === false) {
    return { authorized: false as const, reason: 'Вид работ запрещён договором или дополнительным соглашением' };
  }
  if (workType.requiresContractPermission && effectivePermission !== true) {
    return { authorized: false as const, reason: 'Вид работ не разрешён договором' };
  }
  return {
    authorized: true as const,
    contractId: contract.id,
    addendumId: basis.addendum?.id ?? null,
    wellId: well.id,
    workTypeId: workType.id,
    performedAt: input.performedAt,
  };
}

export async function authorizeWork(actor: User, input: WorkAuthorizationInput) {
  return checkWorkAuthorization(prisma, actor, input);
}

export async function createCustomer(actor: User, input: CustomerInput) {
  const roles = await roleCodes(prisma, actor.id);
  if (!isAdministrator(actor, roles) && !roles.includes('MANAGER')) throw forbidden();
  return prisma.$transaction(async (tx) => {
    const customer = await tx.customer.create({ data: { name: input.name, code: input.code ?? null } });
    await audit(tx, {
      actorId: actor.id,
      action: 'organization.customer.create',
      entityType: 'Customer',
      entityId: customer.id,
      diff: { name: { from: null, to: customer.name }, code: { from: null, to: customer.code } },
    });
    return customer;
  });
}

export async function createContract(actor: User, baseId: number, input: ContractInput) {
  return prisma.$transaction(async (tx) => {
    await assertBaseAccess(tx, actor, baseId);
    const [base, customer, status] = await Promise.all([
      tx.base.findUnique({ where: { id: baseId } }),
      tx.customer.findUnique({ where: { id: input.customerId } }),
      tx.contractStatus.findUnique({ where: { id: input.statusId } }),
    ]);
    if (!base?.isActive) throw notFound('База не найдена или архивирована');
    if (!customer?.isActive) throw badRequest('Заказчик не найден или деактивирован');
    if (!status?.isActive) throw badRequest('Статус договора не найден или деактивирован');
    const contract = await tx.contract.create({
      data: {
        baseId,
        customerId: customer.id,
        statusId: status.id,
        number: input.number,
        startsAt: dateOnly(input.startsAt),
        endsAt: dateOnly(input.endsAt),
        createdById: actor.id,
      },
      include: { customer: true, base: true, status: true },
    });
    await audit(tx, { actorId: actor.id, action: 'organization.contract.create', entityType: 'Contract', entityId: contract.id });
    return contract;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function createAddendum(actor: User, contractId: number, input: AddendumInput) {
  return prisma.$transaction(async (tx) => {
    const contract = await tx.contract.findUnique({ where: { id: contractId } });
    if (!contract) throw notFound('Договор не найден');
    await assertBaseAccess(tx, actor, contract.baseId);
    const status = await tx.addendumStatus.findUnique({ where: { id: input.statusId } });
    if (!status?.isActive) throw badRequest('Статус дополнительного соглашения не найден или деактивирован');
    const addendum = await tx.contractAddendum.create({
      data: {
        contractId,
        statusId: input.statusId,
        number: input.number,
        startsAt: dateOnly(input.startsAt),
        endsAt: dateOnly(input.endsAt),
        description: input.description,
        createdById: actor.id,
      },
      include: { contract: true, status: true },
    });
    await audit(tx, { actorId: actor.id, action: 'organization.addendum.create', entityType: 'ContractAddendum', entityId: addendum.id });
    return addendum;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function createWorkType(actor: User, input: WorkTypeInput) {
  const roles = await roleCodes(prisma, actor.id);
  if (!isAdministrator(actor, roles)) throw forbidden();
  return prisma.$transaction(async (tx) => {
    const workType = await tx.workType.create({ data: input });
    await audit(tx, {
      actorId: actor.id,
      action: 'organization.workType.create',
      entityType: 'WorkType',
      entityId: workType.id,
      diff: { code: { from: null, to: workType.code }, name: { from: null, to: workType.name } },
    });
    return workType;
  });
}

export async function setContractPermission(
  actor: User,
  contractId: number,
  input: ContractPermissionInput,
  addendumId?: number,
) {
  return prisma.$transaction(async (tx) => {
    let contractIdForPermission = contractId;
    if (addendumId) {
      const addendum = await tx.contractAddendum.findUnique({
        where: { id: addendumId },
        include: { contract: true },
      });
      if (!addendum || addendum.contractId !== contractId) throw notFound('Дополнительное соглашение не найдено в этом договоре');
      await assertBaseAccess(tx, actor, addendum.contract.baseId);
      const workType = await tx.workType.findUnique({ where: { id: input.workTypeId } });
      if (!workType?.isActive) throw badRequest('Вид работ не найден или деактивирован');
      const where = { addendumId_workTypeId: { addendumId, workTypeId: input.workTypeId } };
      const previous = await tx.addendumWorkPermission.findUnique({ where });
      const permission = await tx.addendumWorkPermission.upsert({
        where,
        update: { isAllowed: input.isAllowed },
        create: { addendumId, workTypeId: input.workTypeId, isAllowed: input.isAllowed },
      });
      await audit(tx, {
        actorId: actor.id,
        action: 'organization.addendum.permission',
        entityType: 'AddendumWorkPermission',
        entityId: permission.id,
        diff: { isAllowed: { from: previous?.isAllowed ?? null, to: permission.isAllowed } },
      });
      return permission;
    }

    const contract = await tx.contract.findUnique({ where: { id: contractIdForPermission } });
    if (!contract) throw notFound('Договор не найден');
    await assertBaseAccess(tx, actor, contract.baseId);
    const workType = await tx.workType.findUnique({ where: { id: input.workTypeId } });
    if (!workType?.isActive) throw badRequest('Вид работ не найден или деактивирован');
    const where = { contractId_workTypeId: { contractId: contractIdForPermission, workTypeId: input.workTypeId } };
    const previous = await tx.contractWorkPermission.findUnique({ where });
    const permission = await tx.contractWorkPermission.upsert({
      where,
      update: { isAllowed: input.isAllowed },
      create: { contractId: contractIdForPermission, workTypeId: input.workTypeId, isAllowed: input.isAllowed },
    });
    await audit(tx, {
      actorId: actor.id,
      action: 'organization.contract.permission',
      entityType: 'ContractWorkPermission',
      entityId: permission.id,
      diff: { isAllowed: { from: previous?.isAllowed ?? null, to: permission.isAllowed } },
    });
    return permission;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function assignWellBasis(actor: User, wellId: number, input: WellContractBasisInput) {
  try {
    return await prisma.$transaction(async (tx) => {
      const well = await tx.well.findUnique({ where: { id: wellId }, include: { mine: true } });
      if (!well?.isActive || !well.mine.isActive) throw notFound('Скважина или месторождение не найдены');
      await assertBaseAccess(tx, actor, well.mine.baseId);

      const startsAt = dateOnly(input.startsAt);
      const endsAt = input.endsAt ? dateOnly(input.endsAt) : null;
      const overlap = await tx.wellContractBasis.findFirst({
        where: {
          wellId,
          startsAt: { lte: endsAt ?? new Date('9999-12-31T00:00:00.000Z') },
          OR: [{ endsAt: null }, { endsAt: { gte: startsAt } }],
        },
      });
      if (overlap) throw conflict('У скважины уже есть договорное основание на пересекающийся период');

      let contractId = input.contractId ?? null;
      let addendumId = input.addendumId ?? null;
      if (contractId) {
        const contract = await tx.contract.findUnique({ where: { id: contractId } });
        if (!contract || contract.baseId !== well.mine.baseId) throw badRequest('Договор должен относиться к базе скважины');
        if (startsAt < contract.startsAt || (endsAt && endsAt > contract.endsAt)) throw badRequest('Период основания должен входить в период договора');
      } else if (addendumId) {
        const addendum = await tx.contractAddendum.findUnique({ where: { id: addendumId }, include: { contract: true } });
        if (!addendum || addendum.contract.baseId !== well.mine.baseId) {
          throw badRequest('Дополнительное соглашение должно относиться к договору базы скважины');
        }
        if (startsAt < addendum.startsAt || (endsAt && endsAt > addendum.endsAt)) {
          throw badRequest('Период основания должен входить в период дополнительного соглашения');
        }
      }
      const basis = await tx.wellContractBasis.create({
        data: {
          wellId,
          contractId,
          addendumId,
          currentWellId: endsAt === null ? wellId : null,
          startsAt,
          endsAt,
          operationId: randomUUID(),
        },
      });
      await audit(tx, { actorId: actor.id, action: 'organization.well.contractBasis', entityType: 'WellContractBasis', entityId: basis.id });
      return basis;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2002', 'P2034'].includes(error.code)) {
      throw conflict('Договорное основание изменилось параллельно; обновите данные и повторите операцию');
    }
    throw error;
  }
}

export async function recordWork(actor: User, input: WorkExecutionInput) {
  try {
    return await prisma.$transaction(async (tx) => {
      const authorization = await checkWorkAuthorization(tx, actor, input);
      if (!authorization.authorized) throw badRequest(authorization.reason);
      const status = await tx.workStatus.findUnique({ where: { id: input.statusId } });
      if (!status?.isActive) throw badRequest('Статус выполнения работ не найден или деактивирован');
      const responsibleIds = [...new Set(input.responsibleEmployeeIds ?? [])];
      const employees = responsibleIds.length
        ? await tx.employee.findMany({ where: { id: { in: responsibleIds } }, select: { id: true } })
        : [];
      if (employees.length !== responsibleIds.length) throw badRequest('Один или несколько ответственных сотрудников не найдены');
      const execution = await tx.workExecution.create({
        data: {
          wellId: input.wellId,
          workTypeId: input.workTypeId,
          contractId: authorization.contractId,
          addendumId: authorization.addendumId,
          performedAt: dateOnly(input.performedAt),
          statusId: status.id,
          description: input.description ?? null,
          createdById: actor.id,
          responsible: { create: responsibleIds.map((employeeId) => ({ employeeId })) },
        },
        include: { well: true, workType: true, status: true, responsible: { include: { employee: { include: { user: { select: { fullName: true } } } } } } },
      });
      await audit(tx, { actorId: actor.id, action: 'organization.work.record', entityType: 'WorkExecution', entityId: execution.id });
      return execution;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
      throw conflict('Условия выполнения работ изменились параллельно; повторно проверьте разрешение');
    }
    throw error;
  }
}

export async function getEmployee(actor: User, userId: number) {
  const employee = await prisma.employee.findUnique({
    where: { userId },
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          login: true,
          isActive: true,
          isDeleted: true,
          systemRoles: { where: { revokedAt: null, systemRole: { isActive: true } }, include: { systemRole: true } },
        },
      },
      assignments: {
        orderBy: { startsAt: 'desc' },
        include: { position: true, base: true, status: true, supervisor: { include: { user: { select: { fullName: true } } } } },
      },
    },
  });
  if (!employee) throw notFound('Карточка сотрудника не найдена');
  if (!(await canViewEmployee(actor, employee))) throw forbidden();
  return employee;
}

export async function employeeHistory(actor: User, employeeId: number) {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: { assignments: { select: { baseId: true, supervisorEmployeeId: true, activeEmployeeId: true } } },
  });
  if (!employee) throw notFound('Карточка сотрудника не найдена');
  if (!(await canViewEmployee(actor, employee))) throw forbidden();
  const changes = await prisma.organizationChange.findMany({
    where: { employeeId },
    include: { actor: { select: { id: true, fullName: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return changes;
}

export async function listRoles() {
  return prisma.systemRole.findMany({ orderBy: { code: 'asc' } });
}

export async function listPositions() {
  return prisma.position.findMany({
    where: { isArchived: false },
    select: { id: true, name: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });
}
