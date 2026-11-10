import { Prisma } from '@prisma/client';
import { addDays, daysBetween, groupScheduleDays, isIsoDate, type WorkDayStatus } from '@app/shared';
import { prisma, type Tx } from '../../core/db.ts';
import { badRequest, notFound } from '../../core/errors.ts';

export interface ScheduleRange {
  userId: number;
  startDate: string;
  endDate: string;
  status: WorkDayStatus;
}

interface IntervalRecord {
  id?: number;
  userId: number;
  startDate: string;
  endDate: string;
  status: WorkDayStatus;
}

export interface ScheduleRangeReplacement {
  userId: number;
  startDate: string;
  endDate: string;
  intervals: Array<{ startDate: string; endDate: string; status: WorkDayStatus }>;
}

const asDate = (value: string) => new Date(`${value}T00:00:00.000Z`);
const asIsoDate = (value: Date) => value.toISOString().slice(0, 10);
const overlaps = (a: IntervalRecord, b: Pick<IntervalRecord, 'startDate' | 'endDate'>) =>
  a.startDate <= b.endDate && a.endDate >= b.startDate;

function assertRange(startDate: string, endDate: string) {
  if (!isIsoDate(startDate) || !isIsoDate(endDate)) throw badRequest('Invalid schedule date');
  if (endDate < startDate) throw badRequest('End date cannot be earlier than start date');
}

async function lockUsers(tx: Tx, userIds: number[]) {
  const ids = [...new Set(userIds)].sort((a, b) => a - b);
  if (ids.length === 0) return;
  const users = await tx.$queryRaw<Array<{ id: number }>>`
    SELECT id FROM User WHERE id IN (${Prisma.join(ids)}) ORDER BY id FOR UPDATE
  `;
  if (users.length !== ids.length) throw notFound('Employee not found');
}

function coalesce(intervals: IntervalRecord[]): IntervalRecord[] {
  const sorted = [...intervals].sort((a, b) => a.startDate.localeCompare(b.startDate));
  const result: IntervalRecord[] = [];
  for (const interval of sorted) {
    const previous = result.at(-1);
    if (!previous) {
      result.push(interval);
      continue;
    }
    if (previous.endDate >= interval.startDate) {
      throw new Error('Overlapping work schedule intervals detected');
    }
    if (previous.status === interval.status && addDays(previous.endDate, 1) === interval.startDate) {
      previous.endDate = interval.endDate;
      previous.id ??= interval.id;
    } else {
      result.push(interval);
    }
  }
  return result;
}

function replaceTimeline(
  current: IntervalRecord[],
  userId: number,
  startDate: string,
  endDate: string,
  replacements: ScheduleRangeReplacement['intervals'],
): IntervalRecord[] {
  const requested = { startDate, endDate };
  const next: IntervalRecord[] = [];
  for (const interval of current) {
    if (!overlaps(interval, requested)) {
      next.push({ ...interval });
      continue;
    }
    const hasLeft = interval.startDate < startDate;
    const hasRight = interval.endDate > endDate;
    if (hasLeft) next.push({ ...interval, endDate: addDays(startDate, -1) });
    if (hasRight) {
      next.push({
        ...interval,
        ...(hasLeft ? { id: undefined } : {}),
        startDate: addDays(endDate, 1),
      });
    }
  }
  for (const replacement of replacements) {
    assertRange(replacement.startDate, replacement.endDate);
    if (replacement.startDate < startDate || replacement.endDate > endDate) {
      throw badRequest('Replacement interval is outside the requested range');
    }
    next.push({ userId, ...replacement });
  }
  return coalesce(next);
}

async function saveTimeline(tx: Tx, userId: number, current: IntervalRecord[], next: IntervalRecord[]) {
  const desiredIds = new Set(next.flatMap((interval) => interval.id === undefined ? [] : [interval.id]));
  const removedIds = current.flatMap((interval) => interval.id !== undefined && !desiredIds.has(interval.id) ? [interval.id] : []);
  if (removedIds.length) await tx.workScheduleInterval.deleteMany({ where: { id: { in: removedIds } } });

  const byId = new Map(current.flatMap((interval) => interval.id === undefined ? [] : [[interval.id, interval] as const]));
  const created: Array<{ userId: number; startDate: Date; endDate: Date; status: WorkDayStatus; updatedAt: Date }> = [];
  for (const interval of next) {
    if (interval.id === undefined) {
      created.push({ userId, startDate: asDate(interval.startDate), endDate: asDate(interval.endDate), status: interval.status, updatedAt: new Date() });
      continue;
    }
    const previous = byId.get(interval.id);
    if (!previous || previous.startDate !== interval.startDate || previous.endDate !== interval.endDate || previous.status !== interval.status) {
      await tx.workScheduleInterval.update({
        where: { id: interval.id },
        data: { startDate: asDate(interval.startDate), endDate: asDate(interval.endDate), status: interval.status },
      });
    }
  }
  if (created.length) await tx.workScheduleInterval.createMany({ data: created });
}

async function updateDailyProjection(
  tx: Tx,
  userId: number,
  startDate: string,
  endDate: string,
  replacements: ScheduleRangeReplacement['intervals'],
) {
  const where = { userId, date: { gte: asDate(startDate), lte: asDate(endDate) } };
  if (replacements.length === 0) {
    await tx.workScheduleEntry.deleteMany({ where });
    return;
  }
  const existing = await tx.workScheduleEntry.findMany({ where, select: { date: true } });
  const existingDates = new Set(existing.map(({ date }) => asIsoDate(date)));
  const rows: Array<{ userId: number; date: Date; status: WorkDayStatus; updatedAt: Date }> = [];
  for (const interval of replacements) {
    await tx.workScheduleEntry.updateMany({
      where: { userId, date: { gte: asDate(interval.startDate), lte: asDate(interval.endDate) } },
      data: { status: interval.status },
    });
    for (let date = interval.startDate; date <= interval.endDate; date = addDays(date, 1)) {
      if (!existingDates.has(date)) rows.push({ userId, date: asDate(date), status: interval.status, updatedAt: new Date() });
    }
  }
  if (rows.length) await tx.workScheduleEntry.createMany({ data: rows });
}

async function applyReplacement(tx: Tx, replacement: ScheduleRangeReplacement) {
  const { userId, startDate, endDate, intervals } = replacement;
  assertRange(startDate, endDate);
  if (intervals.length > 0) {
    let expectedStart = startDate;
    for (const interval of [...intervals].sort((a, b) => a.startDate.localeCompare(b.startDate))) {
      if (interval.startDate !== expectedStart) throw badRequest('Replacement intervals must cover the entire requested range');
      expectedStart = addDays(interval.endDate, 1);
    }
    if (expectedStart !== addDays(endDate, 1)) throw badRequest('Replacement intervals must cover the entire requested range');
  }
  const currentRows = await tx.workScheduleInterval.findMany({ where: { userId }, orderBy: { startDate: 'asc' } });
  const current: IntervalRecord[] = currentRows.map((row) => ({
    id: row.id,
    userId: row.userId,
    startDate: asIsoDate(row.startDate),
    endDate: asIsoDate(row.endDate),
    status: row.status,
  }));
  const next = replaceTimeline(current, userId, startDate, endDate, intervals);
  await saveTimeline(tx, userId, current, next);
  await updateDailyProjection(tx, userId, startDate, endDate, intervals);
}

export async function setScheduleRange(userId: number, range: ScheduleRange) {
  assertRange(range.startDate, range.endDate);
  await replaceScheduleRanges([{
    userId,
    startDate: range.startDate,
    endDate: range.endDate,
    intervals: [{ startDate: range.startDate, endDate: range.endDate, status: range.status }],
  }]);
}

export async function deleteScheduleRange(userId: number, startDate: string, endDate: string) {
  assertRange(startDate, endDate);
  await replaceScheduleRanges([{ userId, startDate, endDate, intervals: [] }]);
}

export async function replaceScheduleRanges(replacements: ScheduleRangeReplacement[]) {
  for (const replacement of replacements) {
    assertRange(replacement.startDate, replacement.endDate);
  }
  await prisma.$transaction(async (tx) => {
    await lockUsers(tx, replacements.map(({ userId }) => userId));
    for (const replacement of replacements) await applyReplacement(tx, replacement);
  });
}

async function getLegacyDailyIntervals(userId: number, startDate: string, endDate: string) {
  const entries = await prisma.workScheduleEntry.findMany({
    where: { userId, date: { gte: asDate(startDate), lte: asDate(endDate) } },
    orderBy: { date: 'asc' },
  });
  if (entries.length === 0) return [];
  return groupScheduleDays(entries.map((entry) => ({ userId: entry.userId, date: asIsoDate(entry.date), status: entry.status }))).map((interval) => ({
    id: 0,
    userId: interval.userId,
    startDate: asDate(interval.startDate),
    endDate: asDate(interval.endDate),
    status: interval.status,
  }));
}

async function getLegacyAnnualIntervals(userIds: number[], startDate: string, endDate: string) {
  const entries = await prisma.workScheduleEntry.findMany({
    where: { userId: { in: userIds }, date: { gte: asDate(startDate), lte: asDate(endDate) } },
    orderBy: [{ userId: 'asc' }, { date: 'asc' }],
  });
  if (entries.length === 0) return [];
  const byUser = new Map<number, typeof entries>();
  for (const entry of entries) {
    const current = byUser.get(entry.userId) ?? [];
    current.push(entry);
    byUser.set(entry.userId, current);
  }
  const merged: Array<{ id: number; userId: number; startDate: Date; endDate: Date; status: WorkDayStatus }> = [];
  for (const userId of userIds) {
    const daily = byUser.get(userId) ?? [];
    if (!daily.length) continue;
    for (const interval of groupScheduleDays(daily.map((entry) => ({ userId: entry.userId, date: asIsoDate(entry.date), status: entry.status })))) {
      merged.push({
        id: 0,
        userId: interval.userId,
        startDate: asDate(interval.startDate),
        endDate: asDate(interval.endDate),
        status: interval.status,
      });
    }
  }
  return merged;
}

export async function getScheduleIntervals(userId: number, startDate: string, endDate: string) {
  assertRange(startDate, endDate);
  const intervals = await prisma.workScheduleInterval.findMany({
    where: { userId, startDate: { lte: asDate(endDate) }, endDate: { gte: asDate(startDate) } },
    orderBy: { startDate: 'asc' },
  });
  if (intervals.length > 0) return intervals;
  return getLegacyDailyIntervals(userId, startDate, endDate);
}

export async function getAnnualScheduleIntervals(userIds: number[], startDate: string, endDate: string) {
  assertRange(startDate, endDate);
  if (userIds.length === 0) return [];
  const intervals = await prisma.workScheduleInterval.findMany({
    where: { userId: { in: userIds }, startDate: { lte: asDate(endDate) }, endDate: { gte: asDate(startDate) } },
    orderBy: [{ userId: 'asc' }, { startDate: 'asc' }],
  });
  if (intervals.length === 0) return getLegacyAnnualIntervals(userIds, startDate, endDate);
  const covered = new Set(intervals.map(({ userId }) => userId));
  const missing = userIds.filter((userId) => !covered.has(userId));
  if (missing.length === 0) return intervals;
  const fallback = await getLegacyAnnualIntervals(missing, startDate, endDate);
  return [...intervals, ...fallback].sort((a, b) => a.userId - b.userId || a.startDate.getTime() - b.startDate.getTime());
}

export function intervalDto(row: {
  id: number;
  userId: number;
  startDate: Date;
  endDate: Date;
  status: WorkDayStatus;
}) {
  return { id: row.id, userId: row.userId, startDate: asIsoDate(row.startDate), endDate: asIsoDate(row.endDate), status: row.status };
}

export function yearBounds(year: number) {
  return { startDate: `${year}-01-01`, endDate: `${year}-12-31` };
}

export function countDays(startDate: string, endDate: string) {
  return daysBetween(startDate, endDate) + 1;
}
