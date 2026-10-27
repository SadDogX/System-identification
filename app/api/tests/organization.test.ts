import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { todayInTimezone } from '@app/shared';
import { prisma } from '../src/core/db.ts';
import { api, createUser, resetDb, startServer, stopServer, tokenFor } from './helpers.ts';

const iso = (offset = 0) => {
  const date = new Date(`${todayInTimezone('Europe/Moscow')}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
};

async function setup() {
  const admin = await createUser('ADMIN');
  const adminToken = await tokenFor(admin.login);
  const manager = await createUser('USER');
  const coordinator = await createUser('USER');
  const replacementCoordinator = await createUser('USER');
  const employee = await createUser('USER');
  const [managerEmployee, coordinatorEmployee, replacementEmployee, employeeCard] = await Promise.all([
    prisma.employee.findUniqueOrThrow({ where: { userId: manager.id } }),
    prisma.employee.findUniqueOrThrow({ where: { userId: coordinator.id } }),
    prisma.employee.findUniqueOrThrow({ where: { userId: replacementCoordinator.id } }),
    prisma.employee.findUniqueOrThrow({ where: { userId: employee.id } }),
  ]);
  for (const [user, roles] of [
    [manager, ['MANAGER']],
    [coordinator, ['COORDINATOR']],
    [replacementCoordinator, ['COORDINATOR']],
  ] as const) {
    const res = await api('PUT', `/api/admin/org/users/${user.id}/roles`, { token: adminToken, body: { roles } });
    assert.equal(res.status, 200);
  }

  const baseResponse = await api('POST', '/api/admin/org/bases', {
    token: adminToken,
    body: { name: 'Северная база', code: 'NORTH' },
  });
  assert.equal(baseResponse.status, 201);
  const baseId = baseResponse.body.id as number;
  const otherBaseResponse = await api('POST', '/api/admin/org/bases', {
    token: adminToken,
    body: { name: 'Южная база', code: 'SOUTH' },
  });

  for (const [card, supervisorEmployeeId] of [
    [managerEmployee, null],
    [coordinatorEmployee, managerEmployee.id],
    [replacementEmployee, managerEmployee.id],
    [employeeCard, coordinatorEmployee.id],
  ] as const) {
    await prisma.employeeAssignment.update({
      where: { activeEmployeeId: card.id },
      data: { startsAt: new Date(`${iso(-1)}T00:00:00.000Z`) },
    });
    const role = await api('POST', `/api/org/employees/${card.id}/assignments`, {
      token: adminToken,
      body: {
        track: 'TRS',
        baseId,
        ...(supervisorEmployeeId !== null && { supervisorEmployeeId }),
        startsAt: iso(),
      },
    });
    assert.equal(role.status, 201, JSON.stringify(role.body));
  }
  return {
    admin,
    adminToken,
    manager,
    managerToken: await tokenFor(manager.login),
    coordinator,
    coordinatorToken: await tokenFor(coordinator.login),
    replacementCoordinator,
    employee,
    managerEmployee,
    coordinatorEmployee,
    replacementEmployee,
    employeeCard,
    baseId,
    otherBaseId: otherBaseResponse.body.id as number,
  };
}

before(startServer);
after(stopServer);
beforeEach(resetDb);

describe('организационные назначения и доступ', () => {
  it('редактирует базу и запрещает её архивирование при действующих назначениях', async () => {
    const ctx = await setup();
    const renamed = await api('PATCH', `/api/admin/org/bases/${ctx.baseId}`, {
      token: ctx.adminToken,
      body: { name: 'Северная база обновлена', code: 'NORTH-2' },
    });
    assert.equal(renamed.status, 200, JSON.stringify(renamed.body));
    assert.equal(renamed.body.name, 'Северная база обновлена');
    const archive = await api('PATCH', `/api/admin/org/bases/${ctx.baseId}`, {
      token: ctx.adminToken,
      body: { name: 'Северная база обновлена', code: 'NORTH-2', isActive: false },
    });
    assert.equal(archive.status, 409);
  });

  it('разрешает только одного действующего старшего механика на всю компанию', async () => {
    const admin = await createUser('ADMIN');
    const adminToken = await tokenFor(admin.login);
    const first = await createUser('USER');
    const second = await createUser('USER');
    const assigned = await api('PUT', `/api/admin/org/users/${first.id}/roles`, {
      token: adminToken,
      body: { roles: ['SENIOR_MECHANIC'] },
    });
    assert.equal(assigned.status, 200, JSON.stringify(assigned.body));
    const duplicate = await api('PUT', `/api/admin/org/users/${second.id}/roles`, {
      token: adminToken,
      body: { roles: ['SENIOR_MECHANIC'] },
    });
    assert.equal(duplicate.status, 409);
  });

  it('заменяет legacy-заглушку назначением в тот же день без потери истории карточки', async () => {
    const ctx = await setup();
    const user = await createUser('USER');
    const employee = await prisma.employee.findUniqueOrThrow({ where: { userId: user.id } });
    const roles = await api('PUT', `/api/admin/org/users/${user.id}/roles`, {
      token: ctx.adminToken,
      body: { roles: ['MANAGER'] },
    });
    assert.equal(roles.status, 200);

    const assignment = await api('POST', `/api/org/employees/${employee.id}/assignments`, {
      token: ctx.adminToken,
      body: { track: 'TRS', baseId: ctx.baseId, startsAt: iso() },
    });
    assert.equal(assignment.status, 201, JSON.stringify(assignment.body));
    assert.equal(await prisma.employeeAssignment.count({ where: { employeeId: employee.id } }), 1);
    assert.equal(
      await prisma.organizationChange.count({ where: { employeeId: employee.id, action: 'employee.assign' } }),
      1,
    );
    assert.equal(
      (await prisma.employeeAssignment.findUniqueOrThrow({ where: { id: assignment.body.id } })).track,
      'TRS',
    );
  });

  it('создаёт карточку отдельно от учётной записи и сохраняет историю переводов', async () => {
    const ctx = await setup();
    await prisma.employeeAssignment.update({
      where: { activeEmployeeId: ctx.employeeCard.id },
      data: { startsAt: new Date(`${iso(-1)}T00:00:00.000Z`) },
    });
    const before = await prisma.employeeAssignment.count({ where: { employeeId: ctx.employeeCard.id } });
    const beforeTransfers = await prisma.organizationChange.count({
      where: { employeeId: ctx.employeeCard.id, action: 'employee.transfer' },
    });
    const move = await api('POST', `/api/org/employees/${ctx.employeeCard.id}/assignments`, {
      token: ctx.managerToken,
      body: {
        track: 'TRS',
        baseId: ctx.baseId,
        supervisorEmployeeId: ctx.replacementEmployee.id,
        startsAt: iso(),
        reason: 'Замена координатора',
      },
    });
    assert.equal(move.status, 201, JSON.stringify(move.body));
    assert.equal(await prisma.employeeAssignment.count({ where: { employeeId: ctx.employeeCard.id } }), before + 1);
    assert.equal(
      await prisma.employeeAssignment.count({ where: { employeeId: ctx.employeeCard.id, activeEmployeeId: ctx.employeeCard.id } }),
      1,
    );
    assert.equal(
      await prisma.organizationChange.count({ where: { employeeId: ctx.employeeCard.id, action: 'employee.transfer' } }),
      beforeTransfers + 1,
    );
    for (const user of [ctx.employee, ctx.coordinator, ctx.replacementCoordinator]) {
      assert.equal(
        await prisma.notification.count({
          where: { userId: user.id, dedupKey: `org:${move.body.operationId}:${user.id}` },
        }),
        1,
      );
    }
  });

  it('ограничивает менеджера своей базой и уведомляет координаторов о переназначении месторождения', async () => {
    const ctx = await setup();
    const mine = await api('POST', `/api/org/bases/${ctx.baseId}/mines`, {
      token: ctx.managerToken,
      body: { name: 'Месторождение 1', code: 'M-1' },
    });
    assert.equal(mine.status, 201);
    const unauthorized = await api('POST', '/api/org/bases/2/mines', {
      token: ctx.managerToken,
      body: { name: 'Не моя база' },
    });
    assert.equal(unauthorized.status, 403);

    const transfer = await api('POST', `/api/org/mines/${mine.body.id}/coordinator`, {
      token: ctx.managerToken,
      body: { coordinatorEmployeeId: ctx.coordinatorEmployee.id, startsAt: iso() },
    });
    assert.equal(transfer.status, 201, JSON.stringify(transfer.body));
    const firstAssignment = await prisma.mineCoordinatorAssignment.findUniqueOrThrow({
      where: { currentMineId: mine.body.id },
    });
    await prisma.mineCoordinatorAssignment.update({
      where: { id: firstAssignment.id },
      data: { startsAt: new Date(`${iso(-1)}T00:00:00.000Z`) },
    });
    const replacement = await api('POST', `/api/org/mines/${mine.body.id}/coordinator`, {
      token: ctx.managerToken,
      body: {
        coordinatorEmployeeId: ctx.replacementEmployee.id,
        startsAt: iso(),
        reason: 'Перераспределение',
      },
    });
    assert.equal(replacement.status, 201, JSON.stringify(replacement.body));
    assert.equal(await prisma.mineCoordinatorAssignment.count({ where: { mineId: mine.body.id } }), 2);
  });

  it('не позволяет обходить иерархию TRS и назначать сотрудника на чужую базу', async () => {
    const ctx = await setup();
    await prisma.employeeAssignment.update({
      where: { activeEmployeeId: ctx.coordinatorEmployee.id },
      data: { startsAt: new Date(`${iso(-1)}T00:00:00.000Z`) },
    });
    const cycle = await api('POST', `/api/org/employees/${ctx.coordinatorEmployee.id}/assignments`, {
      token: ctx.managerToken,
      body: {
        track: 'TRS',
        baseId: ctx.baseId,
        supervisorEmployeeId: ctx.employeeCard.id,
        startsAt: iso(),
      },
    });
    assert.equal(cycle.status, 400);
    await prisma.employeeAssignment.update({
      where: { activeEmployeeId: ctx.employeeCard.id },
      data: { startsAt: new Date(`${iso(-1)}T00:00:00.000Z`) },
    });
    const foreign = await api('POST', `/api/org/employees/${ctx.employeeCard.id}/assignments`, {
      token: ctx.adminToken,
      body: { track: 'TRS', baseId: ctx.otherBaseId, supervisorEmployeeId: ctx.coordinatorEmployee.id, startsAt: iso() },
    });
    assert.equal(foreign.status, 400);
  });

  it('координатор читает только назначенных ему сотрудников', async () => {
    const ctx = await setup();
    assert.equal((await api('GET', `/api/org/users/${ctx.employee.id}/employee`, { token: ctx.coordinatorToken })).status, 200);
    assert.equal(
      (await api('GET', `/api/org/users/${ctx.replacementCoordinator.id}/employee`, { token: ctx.coordinatorToken })).status,
      403,
    );
    const directReports = await api('GET', '/api/org/employees', { token: ctx.coordinatorToken });
    assert.equal(directReports.status, 200);
    assert.deepEqual(directReports.body.map((row: { id: number }) => row.id), [ctx.employeeCard.id]);
    const history = await api('GET', `/api/org/employees/${ctx.employeeCard.id}/history`, { token: ctx.coordinatorToken });
    assert.equal(history.status, 200);
    assert.ok(history.body.length >= 1);
  });

  it('сводка по удостоверениям ограничена активной зоной менеджера и координатора', async () => {
    const ctx = await setup();
    const managerSummary = await api('GET', '/api/admin/overview', { token: ctx.managerToken });
    assert.equal(managerSummary.status, 200);
    assert.deepEqual(
      managerSummary.body.rows.map((row: { user: { id: number } }) => row.user.id).sort((a: number, b: number) => a - b),
      [ctx.manager.id, ctx.coordinator.id, ctx.replacementCoordinator.id, ctx.employee.id].sort((a, b) => a - b),
    );

    const coordinatorSummary = await api('GET', '/api/admin/overview', { token: ctx.coordinatorToken });
    assert.equal(coordinatorSummary.status, 200);
    assert.deepEqual(
      coordinatorSummary.body.rows.map((row: { user: { id: number } }) => row.user.id).sort((a: number, b: number) => a - b),
      [ctx.coordinator.id, ctx.employee.id].sort((a, b) => a - b),
    );
  });
});

describe('договорное основание выполнения работ', () => {
  it('по умолчанию запрещает работы без явного разрешения, затем разрешает по договору', async () => {
    const ctx = await setup();
    const customer = await api('POST', '/api/org/customers', {
      token: ctx.adminToken,
      body: { name: 'Заказчик TRS', code: 'CUSTOMER-1' },
    });
    assert.equal(customer.status, 201);
    const type = await api('POST', '/api/admin/org/work-types', {
      token: ctx.adminToken,
      body: { code: 'INSPECTION', name: 'Осмотр скважины', requiresContractPermission: true },
    });
    assert.equal(type.status, 201);
    const contractStatus = await prisma.contractStatus.findUniqueOrThrow({ where: { code: 'ACTIVE' } });
    const contract = await api('POST', `/api/org/bases/${ctx.baseId}/contracts`, {
      token: ctx.managerToken,
      body: {
        customerId: customer.body.id,
        statusId: contractStatus.id,
        number: 'N-001',
        startsAt: iso(-10),
        endsAt: iso(10),
      },
    });
    assert.equal(contract.status, 201, JSON.stringify(contract.body));
    const mine = await api('POST', `/api/org/bases/${ctx.baseId}/mines`, {
      token: ctx.managerToken,
      body: { name: 'Месторождение договоров' },
    });
    const well = await api('POST', `/api/org/mines/${mine.body.id}/wells`, {
      token: ctx.managerToken,
      body: { name: 'Скважина 1', code: 'W-1' },
    });
    const basis = await api('POST', `/api/org/wells/${well.body.id}/contract-bases`, {
      token: ctx.managerToken,
      body: { contractId: contract.body.id, startsAt: iso(-10), endsAt: iso(10) },
    });
    assert.equal(basis.status, 201);
    const request = { wellId: well.body.id, workTypeId: type.body.id, performedAt: iso() };
    const denied = await api('POST', '/api/org/work/authorize', { token: ctx.managerToken, body: request });
    assert.equal(denied.status, 200);
    assert.equal(denied.body.authorized, false);

    const permission = await api('PUT', `/api/org/contracts/${contract.body.id}/work-permissions`, {
      token: ctx.managerToken,
      body: { workTypeId: type.body.id, isAllowed: true },
    });
    assert.equal(permission.status, 200);
    const allowed = await api('POST', '/api/org/work/authorize', { token: ctx.managerToken, body: request });
    assert.equal(allowed.status, 200);
    assert.equal(allowed.body.authorized, true);
    const workStatus = await prisma.workStatus.findUniqueOrThrow({ where: { code: 'COMPLETED' } });
    const recorded = await api('POST', '/api/org/work', {
      token: ctx.managerToken,
      body: { ...request, statusId: workStatus.id, responsibleEmployeeIds: [ctx.employeeCard.id] },
    });
    assert.equal(recorded.status, 201, JSON.stringify(recorded.body));
    assert.equal(recorded.body.contractId, contract.body.id);
    assert.equal(recorded.body.responsible.length, 1);

    const addendumStatus = await prisma.addendumStatus.findUniqueOrThrow({ where: { code: 'ACTIVE' } });
    const addendum = await api('POST', `/api/org/contracts/${contract.body.id}/addenda`, {
      token: ctx.managerToken,
      body: {
        statusId: addendumStatus.id,
        number: 'N-001-1',
        startsAt: iso(-5),
        endsAt: iso(5),
        description: 'Исключение для отдельного вида работ',
      },
    });
    assert.equal(addendum.status, 201);
    const secondWell = await api('POST', `/api/org/mines/${mine.body.id}/wells`, {
      token: ctx.managerToken,
      body: { name: 'Скважина 2', code: 'W-2' },
    });
    const addendumBasis = await api('POST', `/api/org/wells/${secondWell.body.id}/contract-bases`, {
      token: ctx.managerToken,
      body: { addendumId: addendum.body.id, startsAt: iso(-5), endsAt: iso(5) },
    });
    assert.equal(addendumBasis.status, 201, JSON.stringify(addendumBasis.body));
    const blockedByAddendum = await api('PUT', `/api/org/contracts/${contract.body.id}/addenda/${addendum.body.id}/work-permissions`, {
      token: ctx.managerToken,
      body: { workTypeId: type.body.id, isAllowed: false },
    });
    assert.equal(blockedByAddendum.status, 200);
    const deniedByAddendum = await api('POST', '/api/org/work/authorize', {
      token: ctx.managerToken,
      body: { ...request, wellId: secondWell.body.id },
    });
    assert.equal(deniedByAddendum.body.authorized, false);
    await api('PUT', `/api/org/contracts/${contract.body.id}/work-permissions`, {
      token: ctx.managerToken,
      body: { workTypeId: type.body.id, isAllowed: false },
    });
    const overrideByAddendum = await api('PUT', `/api/org/contracts/${contract.body.id}/addenda/${addendum.body.id}/work-permissions`, {
      token: ctx.managerToken,
      body: { workTypeId: type.body.id, isAllowed: true },
    });
    assert.equal(overrideByAddendum.status, 200);
    const allowedByAddendum = await api('POST', '/api/org/work/authorize', {
      token: ctx.managerToken,
      body: { ...request, wellId: secondWell.body.id },
    });
    assert.equal(allowedByAddendum.body.authorized, true);
  });
});

describe('системные роли и справочники статусов', () => {
  it('расширяет статусный справочник без изменения схемы и оставляет его администратору', async () => {
    const ctx = await setup();
    const denied = await api('POST', '/api/admin/org/statuses', {
      token: ctx.managerToken,
      body: { category: 'work', code: 'WAITING_REVIEW', name: 'На проверке' },
    });
    assert.equal(denied.status, 403);

    const created = await api('POST', '/api/admin/org/statuses', {
      token: ctx.adminToken,
      body: { category: 'work', code: 'WAITING_REVIEW', name: 'На проверке', sortOrder: 10 },
    });
    assert.equal(created.status, 201);
    const listed = await api('GET', '/api/org/statuses/work', { token: ctx.managerToken });
    assert.equal(listed.status, 200);
    assert.ok(listed.body.some((status: { code: string }) => status.code === 'WAITING_REVIEW'));

    const deactivated = await api('PATCH', `/api/admin/org/statuses/work/${created.body.id}`, {
      token: ctx.adminToken,
      body: { isActive: false },
    });
    assert.equal(deactivated.status, 200);
    assert.equal(
      (await prisma.workStatus.findUniqueOrThrow({ where: { id: created.body.id } })).isActive,
      false,
    );
  });
});
