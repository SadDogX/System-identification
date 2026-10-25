import { Router } from 'express';
import { schedulePeriodSchema, scheduleTemplateSchema, shiftPartnersSchema, workScheduleQuerySchema, workScheduleUpdateSchema, WORK_DAY_STATUSES, type SchedulePeriodRequest, type ScheduleTemplateRequest, type ShiftPartnersRequest } from '@app/shared';
import { currentUser } from '../../core/auth.ts';
import { asyncHandler as h } from '../../core/asyncHandler.ts';
import { adminOnly, signedIn, type AppModule } from '../../core/module.ts';
import { idParam, validQuery, validate } from '../../core/validate.ts';
import { prisma } from '../../core/db.ts';
import { badRequest } from '../../core/errors.ts';

const toDate = (s: string) => new Date(`${s}T00:00:00.000Z`);
const toIsoDate = (d: Date) => d.toISOString().slice(0, 10);
const dateFields = (row: any) => ({ ...row, cycleStart: toIsoDate(row.cycleStart), validFrom: toIsoDate(row.validFrom), validTo: row.validTo ? toIsoDate(row.validTo) : null, startDate: row.startDate ? toIsoDate(row.startDate) : undefined, endDate: row.endDate ? toIsoDate(row.endDate) : undefined });

const dto = (row: any) => ({ id: row.id, userId: row.userId, date: row.date.toISOString().slice(0, 10), status: row.status });
async function getSchedule(userId: number, year: number) {
  const entries = await prisma.workScheduleEntry.findMany({ where: { userId, date: { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) } }, orderBy: { date: 'asc' } });
  const stats = Object.fromEntries(WORK_DAY_STATUSES.map((status) => [status, entries.filter((e) => e.status === status).length]));
  return { userId, year, entries: entries.map(dto), stats };
}
const own = Router(); own.use(...signedIn);
own.get('/', validate(workScheduleQuerySchema, 'query'), h(async (req, res) => { const q = validQuery<{ year?: number }>(req); res.json(await getSchedule(currentUser(req).id, q.year ?? new Date().getFullYear())); }));
const admin = Router(); admin.use(...adminOnly);
admin.get('/', validate(workScheduleQuerySchema, 'query'), h(async (req, res) => { const q = validQuery<{ userId?: number; year?: number }>(req); if (!q.userId) throw badRequest('Выберите сотрудника'); res.json(await getSchedule(q.userId, q.year ?? new Date().getFullYear())); }));
admin.get('/users', h(async (_req, res) => res.json(await prisma.user.findMany({ where: { isDeleted: false, isActive: true }, select: { id: true, fullName: true, login: true }, orderBy: { fullName: 'asc' } }))));
admin.get('/annual', h(async (req, res) => {
  const year = Number(req.query.year) || new Date().getFullYear();
  const users = await prisma.user.findMany({ where: { isDeleted: false, isActive: true }, select: { id: true, fullName: true }, orderBy: { fullName: 'asc' } });
  const entries = await prisma.workScheduleEntry.findMany({ where: { date: { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) } }, orderBy: { date: 'asc' } });
  const byUser = new Map<number, any[]>();
  for (const entry of entries) byUser.set(entry.userId, [...(byUser.get(entry.userId) ?? []), dto(entry)]);
  res.json({ year, rows: users.map((user) => ({ user, entries: byUser.get(user.id) ?? [] })) });
}));
admin.post('/shift-partners/generate', validate(shiftPartnersSchema), h(async (req, res) => {
  const input = req.body as ShiftPartnersRequest;
  if (input.userAId === input.userBId) throw badRequest('Select two different employees');
  const users = await prisma.user.findMany({ where: { id: { in: [input.userAId, input.userBId] }, isDeleted: false, isActive: true }, select: { id: true } });
  if (users.length !== 2) throw badRequest('One or both employees are unavailable');
  const rotationWeeks = Number(input.rotationDays);
  const workDays = rotationWeeks * 7;
  const cycleDays = workDays * 2;
  const start = toDate(input.startDate);
  const end = new Date(Date.UTC(input.year + 1, 0, 1));
  const rows: { userId: number; date: Date; status: (typeof WORK_DAY_STATUSES)[number] }[] = [];
  for (let date = new Date(start); date < end; date.setUTCDate(date.getUTCDate() + 1)) {
    const day = Math.floor((date.getTime() - start.getTime()) / 86400000);
    const cycle = day % cycleDays;
    const statusFor = (isA: boolean) => {
      const workPhase = isA ? cycle < workDays : cycle >= workDays;
      const freePhase = isA ? cycle - workDays : cycle;
      if (!workPhase && (freePhase < input.travelDays || freePhase >= workDays - input.travelDays)) return 'TRAVEL' as const;
      return workPhase ? 'WORK' as const : 'FREE_SHIFT' as const;
    };
    rows.push({ userId: input.userAId, date: new Date(date), status: statusFor(true) }, { userId: input.userBId, date: new Date(date), status: statusFor(false) });
  }
  await prisma.$transaction([
    prisma.workScheduleEntry.deleteMany({ where: { userId: { in: [input.userAId, input.userBId] }, date: { gte: start, lt: end } } }),
    ...rows.map((row) => prisma.workScheduleEntry.create({ data: row })),
  ]);
  res.json({ year: input.year, generated: rows.length, users: [input.userAId, input.userBId] });
}));
admin.get('/templates', h(async (_req, res) => res.json((await prisma.scheduleTemplate.findMany({ include: { user: { select: { id: true, fullName: true } } }, orderBy: { updatedAt: 'desc' } })).map(dateFields))));
admin.post('/templates', validate(scheduleTemplateSchema), h(async (req, res) => { const input = req.body as ScheduleTemplateRequest; const row = await prisma.scheduleTemplate.create({ data: { ...input, userId: input.userId, cycleStart: toDate(input.cycleStart), validFrom: toDate(input.validFrom), validTo: input.validTo ? toDate(input.validTo) : null }, include: { user: { select: { id: true, fullName: true } } } }); res.status(201).json(dateFields(row)); }));
admin.get('/periods', h(async (_req, res) => res.json((await prisma.schedulePeriod.findMany({ include: { user: { select: { id: true, fullName: true } } }, orderBy: { startDate: 'desc' } })).map(dateFields))));
admin.post('/periods', validate(schedulePeriodSchema), h(async (req, res) => { const input = req.body as SchedulePeriodRequest; if (input.endDate < input.startDate) throw badRequest('End date cannot be earlier than start date'); const row = await prisma.schedulePeriod.create({ data: { ...input, startDate: toDate(input.startDate), endDate: toDate(input.endDate) }, include: { user: { select: { id: true, fullName: true } } } }); res.status(201).json(dateFields(row)); }));

admin.delete('/:userId/:date', h(async (req, res) => { const userId = idParam(req, 'userId'); await prisma.workScheduleEntry.deleteMany({ where: { userId, date: toDate(req.params.date) } }); res.status(204).end(); }));
admin.put('/:userId/:date', validate(workScheduleUpdateSchema), h(async (req, res) => { const userId = idParam(req, 'userId'); const input = req.body; const row = await prisma.workScheduleEntry.upsert({ where: { userId_date: { userId, date: toDate(input.date) } }, create: { userId, date: toDate(input.date), status: input.status }, update: { status: input.status } }); res.json(dto(row)); }));
export const workScheduleModule: AppModule = { name: 'work-schedule', routes: [{ path: '/api/me/work-schedule', router: own }, { path: '/api/admin/work-schedule', router: admin }] };
