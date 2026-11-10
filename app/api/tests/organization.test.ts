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
  const manager = await createUser('MANAGER');
  const coordinator = await createUser('COORDINATOR');
  const replacementCoordinator = await createUser('COORDINATOR');
  const employee = await createUser('EMPLOYEE');
  const [managerEmployee, coordinatorEmployee, replacementEmployee, employeeCard] = await Promise.all([
    prisma.employee.findUniqueOrThrow({ where: { userId: manager.id } }),
    prisma.employee.findUniqueOrThrow({ where: { userId: coordinator.id } }),
    prisma.employee.findUniqueOrThrow({ where: { userId: replacementCoordinator.id } }),
    prisma.employee.findUniqueOrThrow({ where: { userId: employee.id } }),
  ]);


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
  it('атомарно создаёт сотрудника вместе с карточкой, системной ролью и назначением', async () => {
    const ctx = await setup();
    const position = await prisma.position.findUniqueOrThrow({ where: { name: 'Test EMPLOYEE position' } });
    const created = await api('POST', '/api/admin/users/personnel', {
      token: ctx.adminToken,
      body: {
        user: { fullName: 'Новый сотрудник', login: 'new-personnel', password: 'password123', positionId: position.id },
        assignment: {
          track: 'TRS',
          baseId: ctx.baseId,
          positionId: position.id,
          supervisorEmployeeId: ctx.coordinatorEmployee.id,
          startsAt: iso(),
        },
      },
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const user = await prisma.user.findUniqueOrThrow({
      where: { login: 'new-personnel' },
      include: { employee: true, systemRoles: { where: { revokedAt: null }, include: { systemRole: true } } },
    });
    assert.equal(created.body.id, user.id);
    assert.ok(user.employee);
    assert.ok(user.systemRoles.some((grant) => grant.systemRole.code === 'EMPLOYEE'));
    const assignment = await prisma.employeeAssignment.findUniqueOrThrow({ where: { activeEmployeeId: user.employee!.id } });
    assert.equal(assignment.track, 'TRS');
    assert.equal(assignment.baseId, ctx.baseId);
    assert.equal(assignment.supervisorEmployeeId, ctx.coordinatorEmployee.id);
  });

  it('откатывает все записи при ошибке создания кадрового назначения', async () => {
    const ctx = await setup();
    const position = await prisma.position.findUniqueOrThrow({ where: { name: 'Test EMPLOYEE position' } });
    const userCreateAuditCount = await prisma.auditLog.count({ where: { action: 'user.create' } });
    const created = await api('POST', '/api/admin/users/personnel', {
      token: ctx.adminToken,
      body: {
        user: { fullName: 'Новый сотрудник', login: 'rolled-back-personnel', password: 'password123', positionId: position.id },
        assignment: {
          track: 'TRS',
          baseId: ctx.baseId,
          positionId: position.id,
          supervisorEmployeeId: 99999999,
          startsAt: iso(),
        },
      },
    });
    assert.equal(created.status, 400, JSON.stringify(created.body));
    assert.equal(await prisma.user.count({ where: { login: 'rolled-back-personnel' } }), 0);
    assert.equal(await prisma.employeeAssignment.count({ where: { employee: { user: { login: 'rolled-back-personnel' } } } }), 0);
    assert.equal(await prisma.userCredential.count({ where: { user: { login: 'rolled-back-personnel' } } }), 0);
    assert.equal(await prisma.auditLog.count({ where: { action: 'user.create' } }), userCreateAuditCount);
  });

  it('редактирует профиль сотрудника и возвращает контакты в справочнике', async () => {
    const ctx = await setup();
    const updated = await api('PATCH', `/api/org/employees/${ctx.employeeCard.id}/profile`, {
      token: ctx.adminToken,
      body: { fullName: 'Новый сотрудник', phone: '+7 900 000-00-00', email: 'employee@example.test' },
    });
    assert.equal(updated.status, 200, JSON.stringify(updated.body));
    const employees = await api('GET', '/api/org/employees', { token: ctx.adminToken });
    assert.equal(employees.status, 200);
    const employee = employees.body.find((item: { id: number }) => item.id === ctx.employeeCard.id);
    assert.equal(employee.user.fullName, 'Новый сотрудник');
    assert.equal(employee.user.phone, '+7 900 000-00-00');
    assert.equal(employee.user.email, 'employee@example.test');
  });

  it('разрешает legacy ADMIN без отдельной системной роли', async () => {
    const admin = await createUser('ADMIN');
    await prisma.userSystemRole.deleteMany({ where: { userId: admin.id } });
    const token = await tokenFor(admin.login);
    const res = await api('GET', '/api/admin/dashboard', { token });
    assert.equal(res.status, 403, JSON.stringify(res.body));
  });

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

  it('сохраняет системные роли пользователя через API и заменяет предыдущие grants', async () => {
    const ctx = await setup();
    const user = await createUser('MANAGER');
    const assigned = await api('PUT', `/api/admin/org/users/${user.id}/roles`, {
      token: ctx.adminToken,
      body: { roles: ['MANAGER'] },
    });
    assert.equal(assigned.status, 200, JSON.stringify(assigned.body));
    assert.deepEqual(assigned.body.roles, ['MANAGER']);

    const replaced = await api('PUT', `/api/admin/org/users/${user.id}/roles`, {
      token: ctx.adminToken,
      body: { roles: ['MANAGER'] },
    });
    assert.equal(replaced.status, 200, JSON.stringify(replaced.body));
    assert.deepEqual(replaced.body.roles, ['MANAGER']);
    const grants = await prisma.userSystemRole.findMany({
      where: { userId: user.id, revokedAt: null },
      include: { systemRole: { select: { code: true } } },
    });
    assert.deepEqual(grants.map((grant) => grant.systemRole.code).sort(), ['MANAGER']);
  });
  it('разрешает только одного действующего старшего механика на всю компанию', async () => {
    const admin = await createUser('ADMIN');
    const adminToken = await tokenFor(admin.login);
    const first = await createUser('EMPLOYEE');
    const second = await createUser('EMPLOYEE');
    const assigned = await api('PUT', `/api/admin/org/users/${first.id}/roles`, {
      token: adminToken,
      body: { roles: ['EMPLOYEE', 'SENIOR_MECHANIC'] },
    });
    assert.equal(assigned.status, 200, JSON.stringify(assigned.body));
    const duplicate = await api('PUT', `/api/admin/org/users/${second.id}/roles`, {
      token: adminToken,
      body: { roles: ['EMPLOYEE', 'SENIOR_MECHANIC'] },
    });
    assert.equal(duplicate.status, 409);
  });

  it('retains the employee current base when a new responsibility omits baseId', async () => {
    const ctx = await setup();
    await prisma.employeeAssignment.update({ where: { activeEmployeeId: ctx.employeeCard.id }, data: { track: 'TRS', startsAt: new Date(iso(-1) + 'T00:00:00.000Z') } });
    const historyBefore = await prisma.employeeAssignment.count({ where: { employeeId: ctx.employeeCard.id } });
    const assigned = await api('POST', `/api/org/employees/${ctx.employeeCard.id}/assignments`, {
      token: ctx.adminToken,
      body: {
        track: 'TRS',
        supervisorEmployeeId: ctx.coordinatorEmployee.id,
        startsAt: iso(),
      },
    });
    assert.equal(assigned.status, 201, JSON.stringify(assigned.body));
    assert.equal(assigned.body.baseId, ctx.baseId);
    assert.equal(await prisma.employeeAssignment.count({ where: { employeeId: ctx.employeeCard.id } }), historyBefore + 1);
    const current = await prisma.employeeAssignment.findUniqueOrThrow({ where: { activeEmployeeId: ctx.employeeCard.id } });
    assert.equal(current.baseId, ctx.baseId);
  });
  it('allows an admin to transfer an employee between bases under a destination-base coordinator and preserves history', async () => {
    const ctx = await setup();
    const destination = await prisma.base.create({ data: { name: 'Destination BPO', code: 'DEST' } });
    const destinationCoordinator = await createUser('COORDINATOR');
    const [coordinatorCard] = await Promise.all([destinationCoordinator].map((person) => prisma.employee.findUniqueOrThrow({ where: { userId: person.id } })));
    const destinationMine = await prisma.mine.create({ data: { baseId: destination.id, name: 'Destination field' } });
    const assignedCoordinator = await api('PUT', `/api/admin/org/users/${destinationCoordinator.id}/roles`, { token: ctx.adminToken, body: { roles: ['COORDINATOR'] } });
    assert.equal(assignedCoordinator.status, 200, JSON.stringify(assignedCoordinator.body));
    const activeStatus = await prisma.assignmentStatus.findUniqueOrThrow({ where: { code: 'ACTIVE' } });
    await prisma.employeeAssignment.update({ where: { activeEmployeeId: coordinatorCard.id }, data: { track: 'TRS', baseId: destination.id, statusId: activeStatus.id, startsAt: new Date(`${iso(-5)}T00:00:00.000Z`) } });
    await prisma.mineCoordinatorAssignment.create({ data: { mineId: destinationMine.id, coordinatorId: coordinatorCard.id, currentMineId: destinationMine.id, startsAt: new Date(`${iso(-5)}T00:00:00.000Z`), operationId: 'destination-coordinator', createdById: ctx.admin.id } });
    await prisma.employeeAssignment.update({ where: { activeEmployeeId: ctx.employeeCard.id }, data: { track: 'TRS', startsAt: new Date(`${iso(-5)}T00:00:00.000Z`) } });
    const previous = await prisma.employeeAssignment.findUniqueOrThrow({ where: { activeEmployeeId: ctx.employeeCard.id } });
    const beforeCount = await prisma.employeeAssignment.count({ where: { employeeId: ctx.employeeCard.id } });
    const beforeChanges = await prisma.organizationChange.count({ where: { employeeId: ctx.employeeCard.id, action: 'employee.transfer' } });
    const destinationPosition = await prisma.position.create({ data: { name: 'Test fixture position 1', systemRole: { connect: { code: 'EMPLOYEE' } } } });
    const moved = await api('POST', `/api/org/employees/${ctx.employeeCard.id}/assignments`, { token: ctx.adminToken, body: { track: 'TRS', baseId: destination.id, positionId: destinationPosition.id, supervisorEmployeeId: coordinatorCard.id, startsAt: iso() } });
    assert.equal(moved.status, 201, JSON.stringify(moved.body));
    assert.equal(moved.body.baseId, destination.id);
    assert.equal(await prisma.employeeAssignment.count({ where: { employeeId: ctx.employeeCard.id } }), beforeCount + 1);
    assert.equal((await prisma.employeeAssignment.findUniqueOrThrow({ where: { activeEmployeeId: ctx.employeeCard.id } })).baseId, destination.id);
    assert.equal(await prisma.organizationChange.count({ where: { employeeId: ctx.employeeCard.id, action: 'employee.transfer' } }), beforeChanges + 1);
    assert.equal((await prisma.employeeAssignment.findUniqueOrThrow({ where: { activeEmployeeId: ctx.employeeCard.id } })).positionId, destinationPosition.id);
    assert.equal((await prisma.employeeAssignment.findUniqueOrThrow({ where: { id: previous.id } })).baseId, ctx.baseId);
    const inconsistent = await api('POST', `/api/org/employees/${ctx.employeeCard.id}/assignments`, { token: ctx.adminToken, body: { track: 'R_AND_M', baseId: destination.id, positionId: destinationPosition.id, startsAt: iso() } });
    assert.equal(inconsistent.status, 400, JSON.stringify(inconsistent.body));
    const wrong = await api('POST', `/api/org/employees/${ctx.employeeCard.id}/assignments`, { token: ctx.adminToken, body: { track: 'TRS', baseId: ctx.baseId, supervisorEmployeeId: ctx.coordinatorEmployee.id, startsAt: iso(1) } });
    assert.equal(wrong.status, 400, JSON.stringify(wrong.body));
  });
  it('applies position-derived Coordinator role and enforces Manager supervision in transfer assignment', async () => {
    const ctx = await setup();
    const coordinatorPosition = await prisma.position.create({ data: { name: 'Test fixture position 2', systemRole: { connect: { code: 'COORDINATOR' } } } });
    await prisma.employeeAssignment.update({ where: { activeEmployeeId: ctx.employeeCard.id }, data: { startsAt: new Date(`${iso(-2)}T00:00:00.000Z`) } });
    const assigned = await api('POST', `/api/org/employees/${ctx.employeeCard.id}/assignments`, {
      token: ctx.adminToken,
      body: { track: 'TRS', baseId: ctx.baseId, positionId: coordinatorPosition.id, supervisorEmployeeId: ctx.managerEmployee.id, startsAt: iso() },
    });
    assert.equal(assigned.status, 201, JSON.stringify(assigned.body));
    assert.ok(await prisma.userSystemRole.findFirst({ where: { userId: ctx.employee.id, revokedAt: null, systemRole: { code: 'COORDINATOR' } } }));
    const noManager = await api('POST', `/api/org/employees/${ctx.replacementEmployee.id}/assignments`, {
      token: ctx.adminToken,
      body: { track: 'TRS', baseId: ctx.baseId, positionId: coordinatorPosition.id, supervisorEmployeeId: ctx.employeeCard.id, startsAt: iso() },
    });
    assert.equal(noManager.status, 400);
  });
  it('rejects moving an employee to a different base through assignment API', async () => {
    const ctx = await setup();
    await prisma.employeeAssignment.update({ where: { activeEmployeeId: ctx.employeeCard.id }, data: { track: 'TRS', startsAt: new Date(iso(-1) + 'T00:00:00.000Z') } });
    const otherBase = await prisma.base.create({ data: { name: 'Remote BPO', code: 'REMOTE' } });
    const historyBefore = await prisma.employeeAssignment.count({ where: { employeeId: ctx.employeeCard.id } });
    const moved = await api('POST', `/api/org/employees/${ctx.employeeCard.id}/assignments`, {
      token: ctx.adminToken,
      body: {
        track: 'TRS',
        baseId: otherBase.id,
        supervisorEmployeeId: ctx.coordinatorEmployee.id,
        startsAt: iso(),
      },
    });
    assert.equal(moved.status, 400, JSON.stringify(moved.body));
    const active = await prisma.employeeAssignment.findUniqueOrThrow({ where: { activeEmployeeId: ctx.employeeCard.id } });
    assert.equal(active.baseId, ctx.baseId);
    assert.equal(await prisma.employeeAssignment.count({ where: { employeeId: ctx.employeeCard.id } }), historyBefore);
  });

  it('replaces the legacy placeholder assignment and preserves employee history', async () => {
    const ctx = await setup();
    const user = await createUser('MANAGER');
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
  it('атомарно привязывает договор ко всем скважинам выбранного набора', async () => {
    const ctx = await setup();
    const customer = await api('POST', '/api/org/customers', {
      token: ctx.adminToken,
      body: { name: 'Пакетный заказчик', code: 'BULK-CUSTOMER' },
    });
    const contractStatus = await prisma.contractStatus.findUniqueOrThrow({ where: { code: 'ACTIVE' } });
    const contract = await api('POST', `/api/org/bases/${ctx.baseId}/contracts`, {
      token: ctx.managerToken,
      body: { customerId: customer.body.id, statusId: contractStatus.id, number: 'BULK-001', startsAt: iso(-10), endsAt: iso(10) },
    });
    const mine = await api('POST', `/api/org/bases/${ctx.baseId}/mines`, {
      token: ctx.managerToken,
      body: { name: 'Месторождение для пакетной привязки' },
    });
    const firstWell = await api('POST', `/api/org/mines/${mine.body.id}/wells`, { token: ctx.managerToken, body: { name: 'Пакетная скважина 1' } });
    const secondWell = await api('POST', `/api/org/mines/${mine.body.id}/wells`, { token: ctx.managerToken, body: { name: 'Пакетная скважина 2' } });
    const response = await api('POST', '/api/org/contract-bases/bulk', {
      token: ctx.managerToken,
      body: {
        wellIds: [firstWell.body.id, secondWell.body.id],
        basis: { contractId: contract.body.id, startsAt: iso(-10), endsAt: iso(10) },
      },
    });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    assert.equal(response.body.length, 2);
    assert.equal(await prisma.wellContractBasis.count({ where: { wellId: { in: [firstWell.body.id, secondWell.body.id] } } }), 2);
    const addendumStatus = await prisma.addendumStatus.findUniqueOrThrow({ where: { code: 'ACTIVE' } });
    const addendum = await api('POST', `/api/org/contracts/${contract.body.id}/addenda`, {
      token: ctx.managerToken,
      body: { statusId: addendumStatus.id, number: 'BULK-001-A', startsAt: iso(-5), endsAt: iso(5), description: 'Пакетное основание' },
    });
    const thirdWell = await api('POST', `/api/org/mines/${mine.body.id}/wells`, { token: ctx.managerToken, body: { name: 'Пакетная скважина 3' } });
    const fourthWell = await api('POST', `/api/org/mines/${mine.body.id}/wells`, { token: ctx.managerToken, body: { name: 'Пакетная скважина 4' } });
    const addendumResponse = await api('POST', '/api/org/contract-bases/bulk', {
      token: ctx.managerToken,
      body: {
        wellIds: [thirdWell.body.id, fourthWell.body.id],
        basis: { addendumId: addendum.body.id, startsAt: iso(-5), endsAt: iso(5) },
      },
    });
    assert.equal(addendumResponse.status, 201, JSON.stringify(addendumResponse.body));
    assert.equal(addendumResponse.body.length, 2);
    assert.equal(await prisma.wellContractBasis.count({ where: { wellId: { in: [firstWell.body.id, secondWell.body.id, thirdWell.body.id, fourthWell.body.id] } } }), 4);
  });

  it('откатывает привязки всего набора, если одна скважина не проходит проверку базы', async () => {
    const ctx = await setup();
    const customer = await api('POST', '/api/org/customers', {
      token: ctx.adminToken,
      body: { name: 'Заказчик отката', code: 'ROLLBACK-CUSTOMER' },
    });
    const contractStatus = await prisma.contractStatus.findUniqueOrThrow({ where: { code: 'ACTIVE' } });
    const contract = await api('POST', `/api/org/bases/${ctx.baseId}/contracts`, {
      token: ctx.managerToken,
      body: { customerId: customer.body.id, statusId: contractStatus.id, number: 'ROLLBACK-001', startsAt: iso(-10), endsAt: iso(10) },
    });
    const validMine = await api('POST', `/api/org/bases/${ctx.baseId}/mines`, { token: ctx.managerToken, body: { name: 'Локальное месторождение' } });
    const validWell = await api('POST', `/api/org/mines/${validMine.body.id}/wells`, { token: ctx.managerToken, body: { name: 'Подходящая скважина' } });
    const otherMine = await api('POST', `/api/org/bases/${ctx.otherBaseId}/mines`, { token: ctx.adminToken, body: { name: 'Другая база' } });
    const otherWell = await api('POST', `/api/org/mines/${otherMine.body.id}/wells`, { token: ctx.adminToken, body: { name: 'Скважина другой базы' } });
    const response = await api('POST', '/api/org/contract-bases/bulk', {
      token: ctx.managerToken,
      body: {
        wellIds: [validWell.body.id, otherWell.body.id],
        basis: { contractId: contract.body.id, startsAt: iso(-10), endsAt: iso(10) },
      },
    });
    assert.equal(response.status, 403, JSON.stringify(response.body));
    assert.equal(await prisma.wellContractBasis.count({ where: { wellId: { in: [validWell.body.id, otherWell.body.id] } } }), 0);
  });

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

describe('планирование выездов на работы', () => {
  it('не допускает пересечение выездов одного сотрудника и позволяет редактировать только план', async () => {
    const ctx = await setup();
    const workType = await prisma.workType.create({
      data: { code: 'OVERLAP_TEST', name: 'Плановая работа', requiresContractPermission: true },
    });
    const planInput = {
      baseId: ctx.baseId,
      locationType: 'BASE',
      workTypeId: workType.id,
      startsAt: iso(1),
      endsAt: iso(3),
      responsibleEmployeeIds: [ctx.managerEmployee.id, ctx.employeeCard.id],
    };
    const first = await api('POST', '/api/org/work-assignments', { token: ctx.managerToken, body: planInput });
    assert.equal(first.status, 201, JSON.stringify(first.body));

    const touchingDates = await api('POST', '/api/org/work-assignments', {
      token: ctx.managerToken,
      body: { ...planInput, startsAt: iso(3), endsAt: iso(4) },
    });
    assert.equal(touchingDates.status, 409);

    const second = await api('POST', '/api/org/work-assignments', {
      token: ctx.managerToken,
      body: { ...planInput, startsAt: iso(4), endsAt: iso(5) },
    });
    assert.equal(second.status, 201, JSON.stringify(second.body));
    const conflictingEdit = await api('PATCH', `/api/org/work-assignments/${second.body.id}`, {
      token: ctx.managerToken,
      body: { ...planInput, startsAt: iso(2), endsAt: iso(4) },
    });
    assert.equal(conflictingEdit.status, 409);

    const edit = await api('PATCH', `/api/org/work-assignments/${second.body.id}`, {
      token: ctx.managerToken,
      body: { ...planInput, startsAt: iso(6), endsAt: iso(7) },
    });
    assert.equal(edit.status, 200, JSON.stringify(edit.body));
    assert.equal(edit.body.startsAt.slice(0, 10), iso(6));
    const auditCount = await prisma.auditLog.count({
      where: { action: 'organization.workAssignment.update', entityId: second.body.id },
    });
    const unchangedEdit = await api('PATCH', `/api/org/work-assignments/${second.body.id}`, {
      token: ctx.managerToken,
      body: { ...planInput, startsAt: iso(6), endsAt: iso(7) },
    });
    assert.equal(unchangedEdit.status, 200);
    assert.equal(
      await prisma.auditLog.count({
        where: { action: 'organization.workAssignment.update', entityId: second.body.id },
      }),
      auditCount,
    );

    const skipToCompleted = await api('PATCH', `/api/org/work-assignments/${second.body.id}/status`, {
      token: ctx.managerToken,
      body: { statusCode: 'COMPLETED' },
    });
    assert.equal(skipToCompleted.status, 409);
    const started = await api('PATCH', `/api/org/work-assignments/${second.body.id}/status`, {
      token: ctx.managerToken,
      body: { statusCode: 'IN_PROGRESS' },
    });
    assert.equal(started.status, 200);
    assert.equal(started.body.status.code, 'IN_PROGRESS');

    const editStarted = await api('PATCH', `/api/org/work-assignments/${second.body.id}`, {
      token: ctx.managerToken,
      body: { ...planInput, startsAt: iso(6), endsAt: iso(7) },
    });
    assert.equal(editStarted.status, 409);
    const cancelled = await api('PATCH', `/api/org/work-assignments/${second.body.id}/status`, {
      token: ctx.managerToken,
      body: { statusCode: 'CANCELLED' },
    });
    assert.equal(cancelled.status, 200);
    assert.equal(cancelled.body.status.code, 'CANCELLED');

    const replacement = await api('POST', '/api/org/work-assignments', {
      token: ctx.managerToken,
      body: { ...planInput, startsAt: iso(6), endsAt: iso(7) },
    });
    assert.equal(replacement.status, 201, JSON.stringify(replacement.body));
    const inProgress = await api('PATCH', `/api/org/work-assignments/${replacement.body.id}/status`, {
      token: ctx.managerToken,
      body: { statusCode: 'IN_PROGRESS' },
    });
    assert.equal(inProgress.status, 200);
    const completed = await api('PATCH', `/api/org/work-assignments/${replacement.body.id}/status`, {
      token: ctx.managerToken,
      body: { statusCode: 'COMPLETED' },
    });
    assert.equal(completed.status, 200);
    assert.equal(completed.body.status.code, 'COMPLETED');
    const reopen = await api('PATCH', `/api/org/work-assignments/${replacement.body.id}/status`, {
      token: ctx.managerToken,
      body: { statusCode: 'CANCELLED' },
    });
    assert.equal(reopen.status, 409);
  });

  it('запрещает участнику команды менять план и статус выезда', async () => {
    const ctx = await setup();
    const workType = await prisma.workType.create({
      data: { code: 'ACCESS_TEST', name: 'План на проверку доступа', requiresContractPermission: true },
    });
    const input = {
      baseId: ctx.baseId,
      locationType: 'BASE',
      workTypeId: workType.id,
      startsAt: iso(1),
      endsAt: iso(2),
      responsibleEmployeeIds: [ctx.managerEmployee.id, ctx.employeeCard.id],
    };
    const plan = await api('POST', '/api/org/work-assignments', { token: ctx.managerToken, body: input });
    assert.equal(plan.status, 201, JSON.stringify(plan.body));
    const employeeToken = await tokenFor(ctx.employee.login);
    const edit = await api('PATCH', `/api/org/work-assignments/${plan.body.id}`, {
      token: employeeToken,
      body: { ...input, endsAt: iso(3) },
    });
    assert.equal(edit.status, 403);
    const status = await api('PATCH', `/api/org/work-assignments/${plan.body.id}/status`, {
      token: employeeToken,
      body: { statusCode: 'IN_PROGRESS' },
    });
    assert.equal(status.status, 403);
  });

  it('проверяет руководителя команды, место работы и ограничивает личный список сотрудника', async () => {
    const ctx = await setup();
    const mine = await api('POST', `/api/org/bases/${ctx.baseId}/mines`, {
      token: ctx.managerToken,
      body: { name: 'Месторождение выездов', code: 'TRIPS-1' },
    });
    assert.equal(mine.status, 201);
    const well = await api('POST', `/api/org/mines/${mine.body.id}/wells`, {
      token: ctx.managerToken,
      body: { name: 'Скважина выездов', clusterNumber: 'К-12' },
    });
    assert.equal(well.status, 201);
    const workType = await prisma.workType.create({
      data: { code: 'PLANNED_TEST', name: 'Спуск ОК', requiresContractPermission: true },
    });

    const missingLeader = await api('POST', '/api/org/work-assignments', {
      token: ctx.managerToken,
      body: {
        baseId: ctx.baseId,
        locationType: 'WELL',
        mineId: mine.body.id,
        wellId: well.body.id,
        workTypeId: workType.id,
        startsAt: iso(1),
        endsAt: iso(3),
        responsibleEmployeeIds: [ctx.employeeCard.id],
      },
    });
    assert.equal(missingLeader.status, 400);

    const created = await api('POST', '/api/org/work-assignments', {
      token: ctx.managerToken,
      body: {
        baseId: ctx.baseId,
        locationType: 'WELL',
        mineId: mine.body.id,
        wellId: well.body.id,
        workTypeId: workType.id,
        startsAt: iso(1),
        endsAt: iso(3),
        responsibleEmployeeIds: [ctx.coordinatorEmployee.id, ctx.employeeCard.id],
      },
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.equal(created.body.clusterNumber, 'К-12');
    assert.equal(created.body.responsible.length, 2);

    const ownPlans = await api('GET', '/api/org/work-assignments', { token: await tokenFor(ctx.employee.login) });
    assert.equal(ownPlans.status, 200);
    assert.deepEqual(ownPlans.body.map((plan: { id: number }) => plan.id), [created.body.id]);
    const otherEmployeePlans = await api('GET', '/api/org/work-assignments', { token: ctx.replacementCoordinator ? await tokenFor(ctx.replacementCoordinator.login) : undefined });
    assert.equal(otherEmployeePlans.status, 200);
    assert.equal(otherEmployeePlans.body.length, 0);
  });

  it('разрешает координатору планировать только выезды в закреплённое месторождение', async () => {
    const ctx = await setup();
    const mine = await api('POST', `/api/org/bases/${ctx.baseId}/mines`, {
      token: ctx.managerToken,
      body: { name: 'Проект координатора', code: 'COORD-1' },
    });
    assert.equal(mine.status, 201);
    const well = await api('POST', `/api/org/mines/${mine.body.id}/wells`, {
      token: ctx.managerToken,
      body: { name: 'Скважина куста', clusterNumber: 'К-8' },
    });
    assert.equal(well.status, 201);
    const coordinatorAssignment = await api('POST', `/api/org/mines/${mine.body.id}/coordinator`, {
      token: ctx.managerToken,
      body: { coordinatorEmployeeId: ctx.coordinatorEmployee.id, startsAt: iso() },
    });
    assert.equal(coordinatorAssignment.status, 201);
    const otherBase = await prisma.base.create({ data: { name: 'Remote BPO', code: 'REMOTE' } });
    await prisma.employeeAssignment.update({
      where: { activeEmployeeId: ctx.replacementEmployee.id },
      data: { baseId: otherBase.id },
    });
    const wrongBase = await api('POST', `/api/org/mines/${mine.body.id}/coordinator`, {
      token: ctx.adminToken,
      body: { coordinatorEmployeeId: ctx.replacementEmployee.id, startsAt: iso(1) },
    });
    assert.equal(wrongBase.status, 400, JSON.stringify(wrongBase.body));
    const workType = await prisma.workType.create({
      data: { code: 'COORD_PLAN_TEST', name: 'Заканчивание', requiresContractPermission: true },
    });
    const scheduled = await api('POST', '/api/org/work-assignments', {
      token: ctx.coordinatorToken,
      body: {
        baseId: ctx.baseId,
        locationType: 'CLUSTER',
        mineId: mine.body.id,
        clusterNumber: 'К-8',
        workTypeId: workType.id,
        startsAt: iso(2),
        endsAt: iso(4),
        responsibleEmployeeIds: [ctx.coordinatorEmployee.id, ctx.employeeCard.id],
      },
    });
    assert.equal(scheduled.status, 201, JSON.stringify(scheduled.body));
    const visible = await api('GET', '/api/org/work-assignments', { token: ctx.coordinatorToken });
    assert.equal(visible.status, 200);
    assert.deepEqual(visible.body.map((plan: { id: number }) => plan.id), [scheduled.body.id]);
  });
});

describe('team work schedule access', () => {
  it('allows manager and coordinator schedule editing only in their scopes', async () => {
    const ctx = await setup();
    const date = iso(2);
    const body = { date, status: 'VACATION' };
    const coordUsers = await api('GET', '/api/team/work-schedule/users', { token: ctx.coordinatorToken });
    assert.equal(coordUsers.status, 200, JSON.stringify(coordUsers.body));
    assert.deepEqual(coordUsers.body.map((row: { id: number }) => row.id).sort(), [ctx.coordinator.id, ctx.employee.id].sort());
    const managerUsers = await api('GET', '/api/team/work-schedule/users', { token: ctx.managerToken });
    assert.equal(managerUsers.status, 200, JSON.stringify(managerUsers.body));
    assert.equal(managerUsers.body.length, 4);
    const annual = await api('GET', '/api/team/work-schedule/annual?year=' + Number(date.slice(0, 4)), { token: ctx.coordinatorToken });
    assert.equal(annual.status, 200, JSON.stringify(annual.body));
    assert.equal(annual.body.rows.length, 2);
    const saved = await api('PUT', '/api/team/work-schedule/' + ctx.employee.id + '/' + date, { token: ctx.coordinatorToken, body });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    assert.equal(saved.body.status, 'VACATION');
    const outsider = await createUser('USER');
    assert.equal((await api('GET', '/api/team/work-schedule?userId=' + outsider.id, { token: ctx.coordinatorToken })).status, 403);
    assert.equal((await api('PUT', '/api/team/work-schedule/' + outsider.id + '/' + date, { token: ctx.managerToken, body })).status, 403);
    assert.equal((await api('DELETE', '/api/team/work-schedule/' + outsider.id + '/' + date, { token: ctx.coordinatorToken })).status, 403);
    assert.equal((await api('GET', '/api/team/work-schedule/users', { token: await tokenFor(ctx.employee.login) })).status, 403);
  });
});

describe('position role synchronization', () => {
  it('returns the existing position-to-system-role mapping to the assignment UI', async () => {
    const ctx = await setup();
    const manager = await prisma.position.create({ data: { name: 'Test fixture position 3', systemRole: { connect: { code: 'MANAGER' } } } });
    const coordinator = await prisma.position.create({ data: { name: 'Test fixture position 4', systemRole: { connect: { code: 'COORDINATOR' } } } });
    const other = await prisma.position.create({ data: { name: 'Test fixture position 5', systemRole: { connect: { code: 'EMPLOYEE' } } } });
    const listed = await api('GET', '/api/org/positions', { token: ctx.adminToken });
    assert.equal(listed.status, 200, JSON.stringify(listed.body));
    assert.equal(listed.body.find((row: { id: number }) => row.id === manager.id).systemRole.code, 'MANAGER');
    assert.equal(listed.body.find((row: { id: number }) => row.id === coordinator.id).systemRole.code, 'COORDINATOR');
    assert.equal(listed.body.find((row: { id: number }) => row.id === other.id).systemRole.code, 'EMPLOYEE');
  });
  it('maps Manager and Coordinator titles to active role grants', async () => {
    const ctx = await setup();
    const managerPosition = await prisma.position.create({ data: { name: 'Test fixture position 6', systemRole: { connect: { code: 'MANAGER' } } } });
    const coordinatorPosition = await prisma.position.create({ data: { name: 'Test fixture position 7', systemRole: { connect: { code: 'COORDINATOR' } } } });
    const createdByTitle = await api('POST', '/api/admin/users', { token: ctx.adminToken, body: { fullName: 'Created manager', login: 'createdmanager', password: 'password123', positionId: managerPosition.id } });
    assert.equal(createdByTitle.status, 201, JSON.stringify(createdByTitle.body));
    assert.ok(createdByTitle.body.systemRoles.includes('MANAGER'));
    const manager = await createUser('USER');
    const createManager = await api('PATCH', '/api/admin/users/' + manager.id, { token: ctx.adminToken, body: { positionId: managerPosition.id } });
    assert.equal(createManager.status, 200, JSON.stringify(createManager.body));
    assert.ok(createManager.body.systemRoles.includes('MANAGER'));
    assert.equal(createManager.body.systemRoles.includes('COORDINATOR'), false);
    const managerToken = await tokenFor(manager.login);
    const managerCanOpenCoordinatorPage = await api('GET', '/api/org/customer-site-works/options', { token: managerToken });
    assert.equal(managerCanOpenCoordinatorPage.status, 200, JSON.stringify(managerCanOpenCoordinatorPage.body));
    const change = await api('PATCH', '/api/admin/users/' + manager.id, { token: ctx.adminToken, body: { positionId: coordinatorPosition.id } });
    assert.equal(change.status, 200, JSON.stringify(change.body));
    assert.ok(change.body.systemRoles.includes('COORDINATOR'));
    assert.equal(change.body.systemRoles.includes('MANAGER'), false);
  });
  it('assigns the role from the position before validating assignment hierarchy', async () => {
    const ctx = await setup();
    const coordinatorPosition = await prisma.position.create({ data: { name: 'Test fixture position 8', systemRole: { connect: { code: 'COORDINATOR' } } } });
    const employee = await createUser('USER');
    const card = await prisma.employee.findUniqueOrThrow({ where: { userId: employee.id } });
    await prisma.employeeAssignment.update({ where: { activeEmployeeId: card.id }, data: { startsAt: new Date(iso(-1) + 'T00:00:00.000Z') } });
    const assignment = await api('POST', '/api/org/employees/' + card.id + '/assignments', { token: ctx.adminToken, body: { track: 'TRS', baseId: ctx.baseId, positionId: coordinatorPosition.id, supervisorEmployeeId: ctx.managerEmployee.id, startsAt: iso() } });
    assert.equal(assignment.status, 201, JSON.stringify(assignment.body));
    const grants = await prisma.userSystemRole.findMany({ where: { userId: employee.id, revokedAt: null }, include: { systemRole: { select: { code: true } } } });
    assert.ok(grants.some((grant) => grant.systemRole.code === 'COORDINATOR'));
  });
});

describe('customer site work registration', () => {
  it('restricts coordinators to their teams and marks overlaps', async () => {
    const ctx = await setup();
    const mine = await api('POST', '/api/org/bases/' + ctx.baseId + '/mines', { token: ctx.managerToken, body: { name: 'Customer site mine', code: 'CSW-1' } });
    assert.equal(mine.status, 201, JSON.stringify(mine.body));
    const well = await api('POST', '/api/org/mines/' + mine.body.id + '/wells', { token: ctx.managerToken, body: { name: 'Customer site well', clusterNumber: 'CL-1' } });
    assert.equal(well.status, 201, JSON.stringify(well.body));
    const assignment = await api('POST', '/api/org/mines/' + mine.body.id + '/coordinator', { token: ctx.managerToken, body: { coordinatorEmployeeId: ctx.coordinatorEmployee.id, startsAt: iso() } });
    assert.equal(assignment.status, 201, JSON.stringify(assignment.body));
    const customer = await prisma.customer.create({ data: { name: 'Customer site test' } });
    const options = await api('GET', '/api/org/customer-site-works/options', { token: ctx.coordinatorToken });
    assert.equal(options.status, 200, JSON.stringify(options.body));
    assert.deepEqual(options.body.supervisors.map((item: { id: number }) => item.id), [ctx.employeeCard.id]);
    const input = { name: 'Customer job', customerId: customer.id, mineId: mine.body.id, wellId: well.body.id, startsAt: iso(1), expectedEndAt: iso(4), supervisorEmployeeId: ctx.employeeCard.id };
    const first = await api('POST', '/api/org/customer-site-works', { token: ctx.coordinatorToken, body: input });
    assert.equal(first.status, 201, JSON.stringify(first.body));
    assert.equal(first.body.hasOverlap, false);
    const wrongSupervisor = await api('POST', '/api/org/customer-site-works', { token: ctx.coordinatorToken, body: { ...input, name: 'Wrong supervisor', supervisorEmployeeId: ctx.managerEmployee.id } });
    assert.equal(wrongSupervisor.status, 400);
    const overlap = await api('POST', '/api/org/customer-site-works', { token: ctx.coordinatorToken, body: { ...input, name: 'Overlapping job', startsAt: iso(2), expectedEndAt: iso(5) } });
    assert.equal(overlap.status, 201, JSON.stringify(overlap.body));
    assert.equal(overlap.body.hasOverlap, true);
    assert.equal(overlap.body.status, 'OVERLAP');
    const listed = await api('GET', '/api/org/customer-site-works', { token: ctx.coordinatorToken });
    assert.equal(listed.body.length, 2);
    assert.ok(listed.body.every((item: { hasOverlap: boolean; status: string }) => item.hasOverlap && item.status === 'OVERLAP'));
    const denied = await api('GET', '/api/org/customer-site-works/options', { token: await tokenFor(ctx.employee.login) });
    assert.equal(denied.status, 403);
  });
});

describe('системные роли и справочники статусов', () => {
  it('расширяет статусный справочник без изменения схемы и оставляет его администратору', async () => {
    const ctx = await setup();
    const statusCode = `WAITING_REVIEW_${ctx.admin.id}`;
    const denied = await api('POST', '/api/admin/org/statuses', {
      token: ctx.managerToken,
      body: { category: 'work', code: statusCode, name: 'На проверке' },
    });
    assert.equal(denied.status, 403);

    const created = await api('POST', '/api/admin/org/statuses', {
      token: ctx.adminToken,
      body: { category: 'work', code: statusCode, name: 'На проверке', sortOrder: 10 },
    });
    assert.equal(created.status, 201);
    const listed = await api('GET', '/api/org/statuses/work', { token: ctx.managerToken });
    assert.equal(listed.status, 200);
    assert.ok(listed.body.some((status: { code: string }) => status.code === statusCode));

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
