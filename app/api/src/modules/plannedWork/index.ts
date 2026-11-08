import { Router } from 'express';
import { asyncHandler as h } from '../../core/asyncHandler.ts';
import { currentUser } from '../../core/auth.ts';
import { badRequest } from '../../core/errors.ts';
import { signedIn, type AppModule } from '../../core/module.ts';
import { idParam, validate, validQuery } from '../../core/validate.ts';
import { plannedWorkSchema, plannedWorkYearSchema } from './plannedWork.schema.ts';
import * as service from './plannedWork.service.ts';

const router = Router();
router.use(...signedIn);
router.get('/options', h(async (req, res) => res.json(await service.getOptions(currentUser(req)))));
router.get('/', validate(plannedWorkYearSchema, 'query'), h(async (req, res) => {
  const { year } = validQuery<{ year: number }>(req);
  const current = new Date().getFullYear();
  if (year < current - 5 || year > current) throw badRequest('Year must be current year or one of the previous five years');
  res.json(await service.list(currentUser(req), year));
}));
router.get('/:id', h(async (req, res) => res.json(await service.getOne(currentUser(req), idParam(req)))));
router.post('/', validate(plannedWorkSchema), h(async (req, res) => res.status(201).json(await service.create(currentUser(req), req.body))));
router.put('/:id', validate(plannedWorkSchema), h(async (req, res) => res.json(await service.update(currentUser(req), idParam(req), req.body))));
router.delete('/:id', h(async (req, res) => { await service.remove(currentUser(req), idParam(req)); res.status(204).end(); }));

export const plannedWorkModule: AppModule = { name: 'planned-work', routes: [{ path: '/api/planned-work', router }] };
