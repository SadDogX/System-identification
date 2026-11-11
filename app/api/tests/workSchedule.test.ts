import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../src/core/db.ts';
import { api, createUser, resetDb, startServer, stopServer, tokenFor } from './helpers.ts';

before(startServer);
after(stopServer);
beforeEach(resetDb);

describe('interval work schedule API', () => {
  it('replaces, splits, merges, and deletes date ranges while keeping daily reads compatible', async () => {
    const admin = await createUser('ADMIN');
    const adminToken = await tokenFor(admin.login);
    const employee = await createUser('EMPLOYEE');
    const root = `/api/admin/work-schedule`;
    const initial = await api('PUT', `${root}/intervals/${employee.id}`, {
      token: adminToken,
      body: { startDate: '2024-02-27', endDate: '2024-03-02', status: 'WORK' },
    });
    assert.equal(initial.status, 200, JSON.stringify(initial.body));
    assert.equal(initial.body.length, 1);
    assert.deepEqual([initial.body[0].startDate, initial.body[0].endDate], ['2024-02-27', '2024-03-02']);

    const split = await api('PUT', `${root}/intervals/${employee.id}`, {
      token: adminToken,
      body: { startDate: '2024-02-29', endDate: '2024-02-29', status: 'VACATION' },
    });
    assert.equal(split.status, 200, JSON.stringify(split.body));
    const year = await api('GET', `${root}/intervals?userId=${employee.id}&year=2024`, { token: adminToken });
    assert.equal(year.status, 200);
    assert.deepEqual(year.body.intervals.map((row: { startDate: string; endDate: string; status: string }) => [row.startDate, row.endDate, row.status]), [
      ['2024-02-27', '2024-02-28', 'WORK'],
      ['2024-02-29', '2024-02-29', 'VACATION'],
      ['2024-03-01', '2024-03-02', 'WORK'],
    ]);
    assert.equal(year.body.stats.WORK, 4);
    assert.equal(year.body.stats.VACATION, 1);

    const merged = await api('PUT', `${root}/intervals/${employee.id}`, {
      token: adminToken,
      body: { startDate: '2024-02-29', endDate: '2024-02-29', status: 'WORK' },
    });
    assert.equal(merged.status, 200);
    assert.equal(merged.body.length, 1, JSON.stringify({
      response: merged.body,
      rows: await prisma.workScheduleInterval.findMany({ where: { userId: employee.id }, orderBy: { startDate: 'asc' } }),
    }));
    assert.deepEqual([merged.body[0].startDate, merged.body[0].endDate], ['2024-02-27', '2024-03-02']);

    const deleted = await api('DELETE', `${root}/intervals/${employee.id}?startDate=2024-02-28&endDate=2024-03-01`, { token: adminToken });
    assert.equal(deleted.status, 204);
    const afterDelete = await prisma.workScheduleInterval.findMany({ where: { userId: employee.id }, orderBy: { startDate: 'asc' } });
    assert.deepEqual(afterDelete.map((row) => [row.startDate.toISOString().slice(0, 10), row.endDate.toISOString().slice(0, 10)]), [
      ['2024-02-27', '2024-02-27'],
      ['2024-03-02', '2024-03-02'],
    ]);
    const legacy = await api('GET', `${root}?userId=${employee.id}&year=2024`, { token: adminToken });
    assert.deepEqual(legacy.body.entries.map((row: { date: string }) => row.date), ['2024-02-27', '2024-03-02']);
  });

  it('returns empty annual intervals for employees without any interval records', async () => {
    const admin = await createUser('ADMIN');
    const token = await tokenFor(admin.login);
    const employee = await createUser('EMPLOYEE');
    await prisma.workScheduleEntry.createMany({
      data: [
        { userId: employee.id, date: new Date('2024-01-15T00:00:00.000Z'), status: 'WORK' },
        { userId: employee.id, date: new Date('2024-01-16T00:00:00.000Z'), status: 'WORK' },
      ],
    });
    const annual = await api('GET', '/api/admin/work-schedule/annual/intervals?year=2024', { token });
    assert.equal(annual.status, 200, JSON.stringify(annual.body));
    const row = annual.body.rows.find((entry: { user: { id: number } }) => entry.user.id === employee.id);
    assert.ok(row, 'annual intervals should include the employee even without any intervals');
    assert.deepEqual(row.intervals, []);
  });

  it('serializes overlapping concurrent writes and rejects reversed or invalid dates', async () => {
    const admin = await createUser('ADMIN');
    const token = await tokenFor(admin.login);
    const employee = await createUser('EMPLOYEE');
    const path = `/api/admin/work-schedule/intervals/${employee.id}`;
    const writes = await Promise.all([
      api('PUT', path, { token, body: { startDate: '2024-06-01', endDate: '2024-06-03', status: 'WORK' } }),
      api('PUT', path, { token, body: { startDate: '2024-06-02', endDate: '2024-06-04', status: 'VACATION' } }),
    ]);
    assert.deepEqual(writes.map((row) => row.status), [200, 200]);
    const intervals = await prisma.workScheduleInterval.findMany({ where: { userId: employee.id }, orderBy: { startDate: 'asc' } });
    for (let index = 1; index < intervals.length; index += 1) {
      assert.ok(intervals[index - 1].endDate < intervals[index].startDate);
    }

    const reversed = await api('PUT', path, { token, body: { startDate: '2024-07-02', endDate: '2024-07-01', status: 'WORK' } });
    assert.equal(reversed.status, 400);
    const invalid = await api('PUT', path, { token, body: { startDate: '2024-02-30', endDate: '2024-03-01', status: 'WORK' } });
    assert.equal(invalid.status, 400);
  });

  it('generates intervals equivalent to leap-year daily statuses and keeps annual intervals clipped by query year', async () => {
    const admin = await createUser('ADMIN');
    const token = await tokenFor(admin.login);
    const employeeA = await createUser('EMPLOYEE');
    const employeeB = await createUser('EMPLOYEE');
    const generated = await api('POST', '/api/admin/work-schedule/shift-partners/generate', {
      token,
      body: { userAId: employeeA.id, userBId: employeeB.id, year: 2024, startDate: '2024-02-28', rotationDays: '4', travelDays: 1 },
    });
    assert.equal(generated.status, 200, JSON.stringify(generated.body));
    assert.equal(generated.body.generated, 2 * 308);

    const legacy = await api('GET', `/api/admin/work-schedule?userId=${employeeA.id}&year=2024`, { token });
    const intervals = await api('GET', `/api/admin/work-schedule/intervals?userId=${employeeA.id}&year=2024`, { token });
    assert.equal(intervals.status, 200);
    assert.equal(intervals.body.intervals.some((row: { startDate: string; endDate: string }) => row.startDate <= '2024-02-29' && row.endDate >= '2024-02-29'), true);
    const expanded = new Map<string, string>();
    for (const interval of intervals.body.intervals) {
      for (let date = interval.startDate; date <= interval.endDate; ) {
        expanded.set(date, interval.status);
        const next = new Date(`${date}T00:00:00.000Z`);
        next.setUTCDate(next.getUTCDate() + 1);
        date = next.toISOString().slice(0, 10);
      }
    }
    assert.deepEqual([...expanded.entries()].sort(), legacy.body.entries.map((row: { date: string; status: string }) => [row.date, row.status]).sort());
    const annual = await api('GET', '/api/admin/work-schedule/annual/intervals?year=2024', { token });
    assert.equal(annual.status, 200);
    const annualEmployee = annual.body.rows.find((row: { user: { id: number } }) => row.user.id === employeeA.id);
    assert.ok(annualEmployee.intervals.every((row: { startDate: string; endDate: string }) => row.startDate <= '2024-12-31' && row.endDate >= '2024-01-01'));
  });
});
