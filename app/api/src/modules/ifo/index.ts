import { Router } from 'express';
import { ifoProposalSchema, type IfoProposalDto, type IfoProposalRequest, type Paginated } from '@app/shared';
import { currentUser } from '../../core/auth.ts';
import { asyncHandler as h } from '../../core/asyncHandler.ts';
import { adminOnly, signedIn, type AppModule } from '../../core/module.ts';
import { prisma } from '../../core/db.ts';
import { idParam, validate } from '../../core/validate.ts';
import { notFound } from '../../core/errors.ts';

const proposerSelect = { id: true, fullName: true, login: true } as const;
function toDto(row: any): IfoProposalDto { return { ...row, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() }; }
async function list(page: number, pageSize: number): Promise<Paginated<IfoProposalDto>> { const [items, total] = await Promise.all([prisma.ifoProposal.findMany({ include: { proposer: { select: proposerSelect } }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }), prisma.ifoProposal.count()]); return { items: items.map(toDto), total, page, pageSize }; }
const shared = Router(); shared.use(...signedIn);
shared.get('/', h(async (req, res) => { const page = Math.max(1, Number(req.query.page) || 1); const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20)); res.json(await list(page, pageSize)); }));
shared.post('/', validate(ifoProposalSchema), h(async (req, res) => { const row = await prisma.ifoProposal.create({ data: { ...(req.body as IfoProposalRequest), proposerId: currentUser(req).id }, include: { proposer: { select: proposerSelect } } }); res.status(201).json(toDto(row)); }));
const admin = Router(); admin.use(...adminOnly); admin.delete('/:id', h(async (req, res) => { const id = idParam(req); if (!(await prisma.ifoProposal.findUnique({ where: { id } }))) throw notFound('Предложение IFO не найдено'); await prisma.ifoProposal.delete({ where: { id } }); res.status(204).end(); }));
export const ifoModule: AppModule = { name: 'ifo', routes: [{ path: '/api/ifo', router: shared }, { path: '/api/admin/ifo', router: admin }] };
