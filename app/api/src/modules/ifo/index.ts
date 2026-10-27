import { Router } from 'express';
import { ifoProposalSchema, type IfoProposalDto, type IfoProposalRequest, type Paginated } from '@app/shared';
import { currentUser, isAdministrator } from '../../core/auth.ts';
import { asyncHandler as h } from '../../core/asyncHandler.ts';
import { signedIn, type AppModule } from '../../core/module.ts';
import { prisma } from '../../core/db.ts';
import { idParam, validate } from '../../core/validate.ts';
import { notFound } from '../../core/errors.ts';
const proposerSelect = { id: true, fullName: true, login: true } as const;
const toDto = (row: any): IfoProposalDto => ({ ...row, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() });
async function list(where: { proposerId?: number }, page: number, pageSize: number) { const [items, total] = await Promise.all([prisma.ifoProposal.findMany({ where, include: { proposer: { select: proposerSelect } }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }), prisma.ifoProposal.count({ where })]); return { items: items.map(toDto), total, page, pageSize } satisfies Paginated<IfoProposalDto>; }
const router = Router(); router.use(...signedIn);
router.get('/', h(async (req, res) => { const actor = currentUser(req); const page = Math.max(1, Number(req.query.page) || 1); res.json(await list(await isAdministrator(actor) ? {} : { proposerId: actor.id }, page, 100)); }));
router.post('/', validate(ifoProposalSchema), h(async (req, res) => { const row = await prisma.ifoProposal.create({ data: { ...(req.body as IfoProposalRequest), proposerId: currentUser(req).id }, include: { proposer: { select: proposerSelect } } }); res.status(201).json(toDto(row)); }));
router.patch('/:id', validate(ifoProposalSchema), h(async (req, res) => { const actor = currentUser(req); const id = idParam(req); const existing = await prisma.ifoProposal.findUnique({ where: { id } }); if (!existing || (!(await isAdministrator(actor)) && existing.proposerId !== actor.id)) throw notFound('You can only edit your own IFO proposals'); const row = await prisma.ifoProposal.update({ where: { id }, data: req.body, include: { proposer: { select: proposerSelect } } }); res.json(toDto(row)); }));
router.delete('/:id', h(async (req, res) => { const actor = currentUser(req); const id = idParam(req); const existing = await prisma.ifoProposal.findUnique({ where: { id } }); if (!existing || (!(await isAdministrator(actor)) && existing.proposerId !== actor.id)) throw notFound('IFO proposal not found'); await prisma.ifoProposal.delete({ where: { id } }); res.status(204).end(); }));
export const ifoModule: AppModule = { name: 'ifo', routes: [{ path: '/api/ifo', router }] };
