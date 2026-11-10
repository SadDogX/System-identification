import { Prisma } from '@prisma/client';
import { groupScheduleDays, type WorkDayStatus } from '@app/shared';
import { prisma } from '../src/core/db.ts';

const apply = process.argv.includes('--apply');

async function lockUser(tx: Prisma.TransactionClient, userId: number) {
  const rows = await tx.$queryRaw<Array<{ id: number }>>`
    SELECT id FROM User WHERE id = ${userId} FOR UPDATE
  `;
  if (rows.length === 0) throw new Error(`Employee ${userId} no longer exists`);
}

function normalized(rows: Array<{ userId: number; startDate: Date; endDate: Date; status: WorkDayStatus }>) {
  return rows.map(({ userId, startDate, endDate, status }) => ({
    userId,
    startDate: startDate.toISOString().slice(0, 10),
    endDate: endDate.toISOString().slice(0, 10),
    status,
  }));
}

function sameIntervals(
  existing: Array<{ userId: number; startDate: Date; endDate: Date; status: WorkDayStatus }>,
  expected: ReturnType<typeof groupScheduleDays>,
) {
  return JSON.stringify(normalized(existing)) === JSON.stringify(expected);
}

async function backfillUser(userId: number) {
  const rows = await prisma.workScheduleEntry.findMany({
    where: { userId },
    select: { userId: true, date: true, status: true },
    orderBy: { date: 'asc' },
  });
  const expected = groupScheduleDays(rows.map(({ userId: id, date, status }) => ({
    userId: id,
    date: date.toISOString().slice(0, 10),
    status,
  })));
  const existing = await prisma.workScheduleInterval.findMany({
    where: { userId },
    orderBy: { startDate: 'asc' },
  });
  if (existing.length > 0) {
    if (!sameIntervals(existing, expected)) {
      throw new Error(`Existing intervals for employee ${userId} do not exactly match daily rows; refusing to overwrite`);
    }
    return { sourceRows: rows.length, intervalRows: expected.length, action: 'verified-existing' };
  }
  if (!apply || expected.length === 0) {
    return { sourceRows: rows.length, intervalRows: expected.length, action: apply ? 'nothing-to-backfill' : 'dry-run' };
  }
  await prisma.$transaction(async (tx) => {
    await lockUser(tx, userId);
    const currentDaily = await tx.workScheduleEntry.findMany({
      where: { userId },
      select: { userId: true, date: true, status: true },
      orderBy: { date: 'asc' },
    });
    const currentExpected = groupScheduleDays(currentDaily.map(({ userId: id, date, status }) => ({
      userId: id,
      date: date.toISOString().slice(0, 10),
      status,
    })));
    if (JSON.stringify(currentExpected) !== JSON.stringify(expected)) {
      throw new Error(`Daily rows for employee ${userId} changed during backfill; rerun the dry run`);
    }
    const currentIntervals = await tx.workScheduleInterval.findMany({ where: { userId }, orderBy: { startDate: 'asc' } });
    if (currentIntervals.length > 0) {
      if (!sameIntervals(currentIntervals.sort((a, b) => a.startDate.getTime() - b.startDate.getTime()), expected)) {
        throw new Error(`Concurrent interval changes for employee ${userId}; refusing to overwrite`);
      }
      return;
    }
    await tx.workScheduleInterval.createMany({
      data: expected.map(({ userId: id, startDate, endDate, status }) => ({
        userId: id,
        startDate: new Date(`${startDate}T00:00:00.000Z`),
        endDate: new Date(`${endDate}T00:00:00.000Z`),
        status,
        updatedAt: new Date(),
      })),
    });
  });
  return { sourceRows: rows.length, intervalRows: expected.length, action: 'backfilled' };
}

try {
  const users = await prisma.user.findMany({ select: { id: true }, orderBy: { id: 'asc' } });
  let sourceRows = 0;
  let intervalRows = 0;
  const actions: Record<string, number> = {};
  for (const { id } of users) {
    const result = await backfillUser(id);
    sourceRows += result.sourceRows;
    intervalRows += result.intervalRows;
    actions[result.action] = (actions[result.action] ?? 0) + 1;
  }
  console.log(JSON.stringify({
    mode: apply ? 'apply' : 'dry-run',
    users: users.length,
    sourceRows,
    intervalRows,
    estimatedReduction: sourceRows === 0 ? null : 1 - intervalRows / sourceRows,
    actions,
  }, null, 2));
} finally {
  await prisma.$disconnect();
}
