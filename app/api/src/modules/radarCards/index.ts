import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import { radarCardListQuerySchema, radarCardSchema, type Paginated, type RadarCardDto, type RadarCardRequest } from '@app/shared';
import { currentUser } from '../../core/auth.ts';
import { asyncHandler as h } from '../../core/asyncHandler.ts';
import { adminOnly, signedIn, type AppModule } from '../../core/module.ts';
import { idParam, validQuery, validate } from '../../core/validate.ts';
import { prisma } from '../../core/db.ts';
import { badRequest, notFound } from '../../core/errors.ts';

const userSelect = { id: true, fullName: true, login: true } as const;
function toDto(row: any): RadarCardDto { return { ...row, incidentDate: row.incidentDate.toISOString().slice(0, 10), createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() }; }
function dateWhere(q: { from?: string; to?: string; previousMonth?: boolean }): Prisma.RadarCardWhereInput {
  if (q.previousMonth) { const now = new Date(); return { incidentDate: { gte: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)), lt: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)) } }; }
  return { ...((q.from || q.to) ? { incidentDate: { ...(q.from ? { gte: new Date(`${q.from}T00:00:00.000Z`) } : {}), ...(q.to ? { lte: new Date(`${q.to}T23:59:59.999Z`) } : {}) } } : {}) };
}
async function list(where: Prisma.RadarCardWhereInput, page: number, pageSize: number): Promise<Paginated<RadarCardDto>> { const [items, total] = await Promise.all([prisma.radarCard.findMany({ where, include: { user: { select: userSelect } }, orderBy: [{ incidentDate: 'desc' }, { createdAt: 'desc' }], skip: (page - 1) * pageSize, take: pageSize }), prisma.radarCard.count({ where })]); return { items: items.map(toDto), total, page, pageSize }; }

const shared = Router(); shared.use(...signedIn);
shared.get('/users', h(async (_req, res) => { res.json(await prisma.user.findMany({ where: { isDeleted: false, isActive: true }, select: { id: true, fullName: true, login: true }, orderBy: { fullName: 'asc' } })); }));
shared.get('/', validate(radarCardListQuerySchema, 'query'), h(async (req, res) => { const q = validQuery<any>(req); res.json(await list(dateWhere(q), q.page, q.pageSize)); }));
shared.post('/', validate(radarCardSchema), h(async (req, res) => { const input = req.body as RadarCardRequest; const actor = currentUser(req); const userId = input.userId ?? actor.id; const user = await prisma.user.findFirst({ where: { id: userId, isDeleted: false, isActive: true } }); if (!user) throw badRequest('Выбранный инициатор недоступен'); const row = await prisma.radarCard.create({ data: { ...input, userId, incidentDate: new Date(`${input.incidentDate}T00:00:00.000Z`) }, include: { user: { select: userSelect } } }); res.status(201).json(toDto(row)); }));
const admin = Router(); admin.use(...adminOnly); admin.delete('/:id', h(async (req, res) => { const id = idParam(req); if (!(await prisma.radarCard.findUnique({ where: { id } }))) throw notFound('Карта радар не найдена'); await prisma.radarCard.delete({ where: { id } }); res.status(204).end(); }));
export const radarCardsModule: AppModule = { name: 'radar-cards', routes: [{ path: '/api/radar-cards', router: shared }, { path: '/api/admin/radar-cards', router: admin }] };
