import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { addDays } from '@app/shared';
import { prisma } from '../src/core/db.ts';
import { conflictDatesForYear, splitWorkSegments, type ConflictWork } from '../src/modules/plannedWork/conflicts.ts';
import { api, createUser, resetDb, startServer, stopServer, tokenFor } from './helpers.ts';

const iso = (offset = 0) => addDays(new Date().toISOString().slice(0, 10), offset);

before(startServer);
after(stopServer);
beforeEach(resetDb);

describe('planned work conflict calendar', () => {
  it('marks every overlapping day across three different pads and preserves green tails', () => {
    const works: ConflictWork[] = [
      { id: 1, mineId: 1, clusterNumber: 'K133', startsAt: '2025-11-10', endsAt: '2025-11-15' },
      { id: 2, mineId: 2, clusterNumber: 'K134', startsAt: '2025-11-12', endsAt: '2025-11-18' },
      { id: 3, mineId: 3, clusterNumber: 'K135', startsAt: '2025-11-14', endsAt: '2025-11-20' },
    ];
    const conflicts = conflictDatesForYear(works, 2025);
    assert.deepEqual([...conflicts.get(1)!], ['2025-11-12', '2025-11-13', '2025-11-14', '2025-11-15']);
    assert.deepEqual(splitWorkSegments(works[0], conflicts.get(1)!, 2025), [
      { startsAt: '2025-11-10', endsAt: '2025-11-11', conflict: false },
      { startsAt: '2025-11-12', endsAt: '2025-11-15', conflict: true },
    ]);
    assert.deepEqual(splitWorkSegments(works[2], conflicts.get(3)!, 2025), [
      { startsAt: '2025-11-14', endsAt: '2025-11-18', conflict: true },
      { startsAt: '2025-11-19', endsAt: '2025-11-20', conflict: false },
    ]);
  });

  it('ignores same-pad overlap and handles distinct pads, year clipping, and leap days', () => {
    const samePad = conflictDatesForYear([
      { id: 1, mineId: 1, clusterNumber: 'K1', startsAt: '2024-02-28', endsAt: '2024-03-01' },
      { id: 2, mineId: 1, clusterNumber: 'K1', startsAt: '2024-02-29', endsAt: '2024-03-02' },
    ], 2024);
    assert.equal(samePad.size, 0);
    const crossPad = conflictDatesForYear([
      { id: 3, mineId: 1, clusterNumber: 'K1', startsAt: '2023-12-30', endsAt: '2024-03-02' },
      { id: 4, mineId: 2, clusterNumber: 'K2', startsAt: '2024-02-29', endsAt: '2024-03-01' },
    ], 2024);
    assert.deepEqual([...crossPad.get(3)!], ['2024-02-29', '2024-03-01']);
    assert.deepEqual(splitWorkSegments({ startsAt: '2023-12-30', endsAt: '2024-03-02' }, crossPad.get(3)!, 2024), [
      { startsAt: '2024-01-01', endsAt: '2024-02-28', conflict: false },
      { startsAt: '2024-02-29', endsAt: '2024-03-01', conflict: true },
      { startsAt: '2024-03-02', endsAt: '2024-03-02', conflict: false },
    ]);
  });

  it('scopes list details by Manager, Coordinator and Employee while preserving cross-coordinator conflict dates', async () => {
    const admin = await createUser('ADMIN');
    const adminToken = await tokenFor(admin.login);
    const base = await prisma.base.create({ data: { name: 'Planned Base', code: 'PLAN' } });
    const otherBase = await prisma.base.create({ data: { name: 'Other Base', code: 'OTHER' } });
    const mineA = await prisma.mine.create({ data: { baseId: base.id, name: 'Field A' } });
    const mineB = await prisma.mine.create({ data: { baseId: base.id, name: 'Field B' } });
    const otherMine = await prisma.mine.create({ data: { baseId: otherBase.id, name: 'Other Field' } });
    const wells = await Promise.all([
      prisma.well.create({ data: { mineId: mineA.id, name: 'A-1', clusterNumber: 'K1' } }),
      prisma.well.create({ data: { mineId: mineB.id, name: 'B-1', clusterNumber: 'K2' } }),
      prisma.well.create({ data: { mineId: otherMine.id, name: 'X-1', clusterNumber: 'K9' } }),
    ]);
    const manager = await createUser('MANAGER');
    const coordA = await createUser('COORDINATOR');
    const coordB = await createUser('COORDINATOR');
    const employee = await createUser('EMPLOYEE');
    const outsider = await createUser('EMPLOYEE');
    const [managerCard, coordACard, coordBCard, employeeCard, outsiderCard, adminCard] = await Promise.all([
      ...[manager, coordA, coordB, employee, outsider, admin].map((user) => prisma.employee.findUniqueOrThrow({ where: { userId: user.id } })),
    ]);
    const coordinatorRole = await prisma.systemRole.findUniqueOrThrow({ where: { code: 'COORDINATOR' } });
    const assignments = [
      [managerCard.id, base.id, 'MANAGER'], [coordACard.id, base.id, 'COORDINATOR'], [coordBCard.id, base.id, 'COORDINATOR'], [employeeCard.id, base.id, 'EMPLOYEE'], [outsiderCard.id, otherBase.id, 'EMPLOYEE'],
    ] as const;
    for (const [cardId, baseId, code] of assignments) {
      const card = [managerCard, coordACard, coordBCard, employeeCard, outsiderCard].find((item) => item.id === cardId)!;
      const role = await prisma.systemRole.findUniqueOrThrow({ where: { code } });
      const existingRole = await prisma.userSystemRole.findFirst({ where: { userId: card.userId, systemRoleId: role.id, revokedAt: null } });
      if (!existingRole) await prisma.userSystemRole.create({ data: { userId: card.userId, systemRoleId: role.id, currentUserRoleKey: `${card.userId}:${role.id}`, assignedById: admin.id } });
      const status = await prisma.assignmentStatus.findUniqueOrThrow({ where: { code: 'ACTIVE' } });
      await prisma.employeeAssignment.update({ where: { activeEmployeeId: cardId }, data: { statusId: status.id, track: 'TRS', baseId, startsAt: new Date('2024-01-01T00:00:00Z') } });
    }
    const assignMine = async (mineId: number, cardId: number, operationId: string) => prisma.mineCoordinatorAssignment.create({ data: { mineId, coordinatorId: cardId, currentMineId: mineId, startsAt: new Date('2024-01-01T00:00:00Z'), operationId, createdById: admin.id } });
    await assignMine(mineA.id, coordACard.id, 'coordinator-a');
    await assignMine(mineB.id, coordBCard.id, 'coordinator-b');
    const now = new Date();
    const planned = async (input: { mineId: number; wellId: number; pad: string; coordinatorId: number; start: string; end: string; participants: number[]; name: string }) => prisma.plannedWork.create({ data: { baseId: base.id, mineId: input.mineId, wellId: input.wellId, clusterNumber: input.pad, name: input.name, startsAt: new Date(`${input.start}T00:00:00Z`), endsAt: new Date(`${input.end}T00:00:00Z`), coordinatorEmployeeId: input.coordinatorId, supervisorEmployeeId: managerCard.id, createdById: admin.id, updatedAt: now, employees: { create: [...new Set(input.participants)].map((employeeId) => ({ employeeId })) } } });
    const year = new Date().getFullYear();
    const first = `${year}-11-10`; const second = `${year}-11-12`; const third = `${year}-11-14`;
    const own = await planned({ mineId: mineA.id, wellId: wells[0].id, pad: 'K1', coordinatorId: coordACard.id, start: first, end: `${year}-11-15`, participants: [employeeCard.id], name: 'Coordinator A work' });
    const samePad = await planned({ mineId: mineA.id, wellId: wells[0].id, pad: 'K1', coordinatorId: coordACard.id, start: `${year}-11-21`, end: `${year}-11-23`, participants: [employeeCard.id], name: 'Same pad work' });
    await planned({ mineId: mineB.id, wellId: wells[1].id, pad: 'K2', coordinatorId: coordBCard.id, start: second, end: `${year}-11-18`, participants: [coordBCard.id], name: 'Coordinator B private work' });
    await planned({ mineId: mineB.id, wellId: wells[1].id, pad: 'K3', coordinatorId: coordBCard.id, start: third, end: `${year}-11-20`, participants: [coordBCard.id], name: 'Same coordinator other pad' });
    const managerRows = await api('GET', `/api/planned-work?year=${year}`, { token: await tokenFor(manager.login) });
    assert.equal(managerRows.status, 200);
    assert.equal(managerRows.body.rows.length, 4);
    const managerOwn = managerRows.body.rows.find((row: { id: number }) => row.id === own.id);
    assert.equal(managerRows.body.rows.find((row: { id: number }) => row.id === samePad.id).segments.some((segment: { conflict: boolean }) => segment.conflict), false);
    assert.ok(managerOwn.segments.some((segment: { conflict: boolean }) => segment.conflict));
    const coordRows = await api('GET', `/api/planned-work?year=${year}`, { token: await tokenFor(coordA.login) });
    assert.equal(coordRows.status, 200);
    assert.equal(coordRows.body.rows.length, 2);
    assert.ok(coordRows.body.rows[0].conflictDates.length > 0);
    assert.equal(JSON.stringify(coordRows.body).includes('Coordinator B private work'), false);
    const employeeRows = await api('GET', `/api/planned-work?year=${year}`, { token: await tokenFor(employee.login) });
    assert.equal(employeeRows.status, 200);
    assert.deepEqual(employeeRows.body.rows.map((row: { id: number }) => row.id), [own.id, samePad.id]);
    const outsiderRows = await api('GET', `/api/planned-work?year=${year}`, { token: await tokenFor(outsider.login) });
    assert.equal(outsiderRows.status, 200);
    assert.equal(outsiderRows.body.rows.length, 0);
    const forbiddenOptions = await api('GET', '/api/planned-work/options', { token: await tokenFor(employee.login) });
    assert.equal(forbiddenOptions.status, 403);
    const crossBase = await api('GET', `/api/planned-work/${own.id}`, { token: await tokenFor(outsider.login) });
    assert.equal(crossBase.status, 403);
  });

  it('creates and edits planned work, validates Base restrictions, and rejects invalid dates', async () => {
    const admin = await createUser('ADMIN'); const token = await tokenFor(admin.login);
    const base = await prisma.base.create({ data: { name: 'CRUD Base', code: 'CRUD' } });
    const mine = await prisma.mine.create({ data: { baseId: base.id, name: 'CRUD Field' } });
    const well = await prisma.well.create({ data: { mineId: mine.id, name: 'Well C', clusterNumber: 'C1' } });
    const coordinator = await createUser('COORDINATOR'); const supervisor = await createUser('EMPLOYEE'); const worker = await createUser('EMPLOYEE');
    const cards = await Promise.all([coordinator, supervisor, worker].map((user) => prisma.employee.findUniqueOrThrow({ where: { userId: user.id } })));
    const status = await prisma.assignmentStatus.findUniqueOrThrow({ where: { code: 'ACTIVE' } });
    for (const card of cards) await prisma.employeeAssignment.update({ where: { activeEmployeeId: card.id }, data: { statusId: status.id, track: 'TRS', baseId: base.id, startsAt: new Date('2024-01-01T00:00:00Z') } });
    await prisma.mineCoordinatorAssignment.create({ data: { mineId: mine.id, coordinatorId: cards[0].id, currentMineId: mine.id, startsAt: new Date('2024-01-01T00:00:00Z'), operationId: 'crud-coord', createdById: admin.id } });
    const body = { name: 'Plan create', mineId: mine.id, clusterNumber: 'C1', wellId: well.id, startsAt: iso(), endsAt: iso(2), coordinatorEmployeeId: cards[0].id, supervisorEmployeeId: cards[1].id, employeeIds: [cards[2].id] };
    const created = await api('POST', '/api/planned-work', { token, body });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.equal(created.body.baseId, base.id);
    const edited = await api('PUT', `/api/planned-work/${created.body.id}`, { token, body: { ...body, name: 'Edited plan' } });
    assert.equal(edited.status, 200, JSON.stringify(edited.body));
    assert.equal(edited.body.name, 'Edited plan');
    const invalidDates = await api('POST', '/api/planned-work', { token, body: { ...body, startsAt: iso(3), endsAt: iso(2) } });
    assert.equal(invalidDates.status, 400);
    const wrongMine = await prisma.mine.create({ data: { baseId: (await prisma.base.create({ data: { name: 'Wrong CRUD Base', code: 'CRUD2' } })).id, name: 'Wrong field' } });
    const wrong = await api('POST', '/api/planned-work', { token, body: { ...body, mineId: wrongMine.id } });
    assert.equal(wrong.status, 400);
  });
});
