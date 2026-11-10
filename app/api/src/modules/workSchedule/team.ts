import { Router } from 'express';
import { countScheduleDaysByStatus, workScheduleIntervalDeleteSchema, workScheduleIntervalSchema, workScheduleQuerySchema, workScheduleUpdateSchema, WORK_DAY_STATUSES } from '@app/shared';
import { currentUser } from '../../core/auth.ts';
import { asyncHandler as h } from '../../core/asyncHandler.ts';
import { signedIn, type AppModule } from '../../core/module.ts';
import { idParam, validQuery, validate } from '../../core/validate.ts';
import { badRequest, forbidden } from '../../core/errors.ts';
import { prisma } from '../../core/db.ts';
import { manageableUserIds, systemRoleCodes } from '../../core/organizationAccess.ts';
import { deleteScheduleRange, getAnnualScheduleIntervals, getScheduleIntervals, intervalDto, setScheduleRange, yearBounds } from './schedule.service.ts';

const toDate = (value: string) => new Date(`${value}T00:00:00.000Z`);
const dto = (row: { id: number; userId: number; date: Date; status: (typeof WORK_DAY_STATUSES)[number] }) => ({ id: row.id, userId: row.userId, date: row.date.toISOString().slice(0, 10), status: row.status });

async function assertScheduleManager(userId: number) {
  const scheduleManagerRoles = ['MANAGER', 'COORDINATOR'];
  const roles = await systemRoleCodes(userId);
  if (!roles.some((role) => scheduleManagerRoles.includes(role))) throw forbidden();
}

async function assertUserInScope(actorId: number, userId: number) {
  const ids = await manageableUserIds(await prisma.user.findUniqueOrThrow({ where: { id: actorId } }));
  if (!ids.includes(userId)) throw forbidden();
}

async function schedule(userId: number, year: number) {
  const entries = await prisma.workScheduleEntry.findMany({ where: { userId, date: { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) } }, orderBy: { date: 'asc' } });
  const stats = Object.fromEntries(WORK_DAY_STATUSES.map((status) => [status, entries.filter((entry) => entry.status === status).length]));
  return { userId, year, entries: entries.map(dto), stats };
}
async function intervalSchedule(userId: number, year: number) {
  const bounds = yearBounds(year);
  const intervals = (await getScheduleIntervals(userId, bounds.startDate, bounds.endDate)).map(intervalDto);
  return { userId, year, intervals, stats: countScheduleDaysByStatus(intervals, bounds.startDate, bounds.endDate) };
}
function assertYear(year: number) {
  if (!Number.isInteger(year) || year < 2020 || year > 2100) throw badRequest('Invalid schedule year');
}

const team = Router();
team.use(...signedIn);
teamsRoutes();
function teamsRoutes() {
  team.get('/users', h(async (req, res) => {
    await assertScheduleManager(currentUser(req).id);
    const ids = await manageableUserIds(currentUser(req));
    const users = await prisma.user.findMany({ where: { id: { in: ids }, isDeleted: false, isActive: true }, select: { id: true, fullName: true, login: true }, orderBy: { fullName: 'asc' } });
    res.json(users);
  }));
  team.get('/annual', h(async (req, res) => {
    const actor = currentUser(req);
    await assertScheduleManager(actor.id);
    const year = Number(req.query.year) || new Date().getFullYear();
    if (!Number.isInteger(year) || year < 2020 || year > 2100) throw badRequest('Invalid schedule year');
    const ids = await manageableUserIds(actor);
    const users = await prisma.user.findMany({ where: { id: { in: ids }, isDeleted: false, isActive: true }, select: { id: true, fullName: true }, orderBy: { fullName: 'asc' } });
    const entries = await prisma.workScheduleEntry.findMany({ where: { userId: { in: users.map(({ id }) => id) }, date: { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) } }, orderBy: { date: 'asc' } });
    const byUser = new Map<number, ReturnType<typeof dto>[]>();
    for (const entry of entries) byUser.set(entry.userId, [...(byUser.get(entry.userId) ?? []), dto(entry)]);
    res.json({ year, rows: users.map((user) => ({ user, entries: byUser.get(user.id) ?? [] })) });
  }));
  team.get('/annual/intervals', h(async (req, res) => {
    const actor = currentUser(req);
    await assertScheduleManager(actor.id);
    const year = Number(req.query.year) || new Date().getFullYear();
    assertYear(year);
    const bounds = yearBounds(year);
    const ids = await manageableUserIds(actor);
    const users = await prisma.user.findMany({ where: { id: { in: ids }, isDeleted: false, isActive: true }, select: { id: true, fullName: true }, orderBy: { fullName: 'asc' } });
    const intervals = (await getAnnualScheduleIntervals(users.map(({ id }) => id), bounds.startDate, bounds.endDate)).map(intervalDto);
    const byUser = new Map<number, typeof intervals>();
    for (const interval of intervals) byUser.set(interval.userId, [...(byUser.get(interval.userId) ?? []), interval]);
    res.json({ year, rows: users.map((user) => ({ user, intervals: byUser.get(user.id) ?? [] })) });
  }));
  team.get('/', validate(workScheduleQuerySchema, 'query'), h(async (req, res) => {
    const actor = currentUser(req);
    await assertScheduleManager(actor.id);
    const query = validQuery<{ userId?: number; year?: number }>(req);
    if (!query.userId) throw badRequest('Choose an employee');
    await assertUserInScope(actor.id, query.userId);
    res.json(await schedule(query.userId, query.year ?? new Date().getFullYear()));
  }));
  team.get('/intervals', validate(workScheduleQuerySchema, 'query'), h(async (req, res) => {
    const actor = currentUser(req);
    await assertScheduleManager(actor.id);
    const query = validQuery<{ userId?: number; year?: number }>(req);
    if (!query.userId) throw badRequest('Choose an employee');
    await assertUserInScope(actor.id, query.userId);
    res.json(await intervalSchedule(query.userId, query.year ?? new Date().getFullYear()));
  }));
  team.put('/intervals/:userId', validate(workScheduleIntervalSchema), h(async (req, res) => {
    const actor = currentUser(req);
    await assertScheduleManager(actor.id);
    const userId = idParam(req, 'userId');
    await assertUserInScope(actor.id, userId);
    await setScheduleRange(userId, { ...req.body, userId });
    const intervals = await getScheduleIntervals(userId, req.body.startDate, req.body.endDate);
    res.json(intervals.map(intervalDto));
  }));
  team.delete('/intervals/:userId', validate(workScheduleIntervalDeleteSchema, 'query'), h(async (req, res) => {
    const actor = currentUser(req);
    await assertScheduleManager(actor.id);
    const userId = idParam(req, 'userId');
    await assertUserInScope(actor.id, userId);
    const query = validQuery<{ startDate: string; endDate: string }>(req);
    await deleteScheduleRange(userId, query.startDate, query.endDate);
    res.status(204).end();
  }));
  team.put('/:userId/:date', validate(workScheduleUpdateSchema), h(async (req, res) => {
    const actor = currentUser(req);
    await assertScheduleManager(actor.id);
    const userId = idParam(req, 'userId');
    await assertUserInScope(actor.id, userId);
    const input = req.body as { date: string; status: (typeof WORK_DAY_STATUSES)[number] };
    await setScheduleRange(userId, { userId, startDate: input.date, endDate: input.date, status: input.status });
    const row = await prisma.workScheduleEntry.findUniqueOrThrow({ where: { userId_date: { userId, date: toDate(input.date) } } });
    res.json(dto(row));
  }));
  team.delete('/:userId/:date', h(async (req, res) => {
    const actor = currentUser(req);
    await assertScheduleManager(actor.id);
    const userId = idParam(req, 'userId');
    await assertUserInScope(actor.id, userId);
    const date = req.params.date;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00.000Z`))) throw badRequest('Invalid date');
    await deleteScheduleRange(userId, date, date);
    res.status(204).end();
  }));
}

export const teamWorkScheduleModule: AppModule = {
  name: 'team-work-schedule',
  routes: [{ path: '/api/team/work-schedule', router: team }],
};
