import { Router } from 'express';
import { currentUser } from '../../core/auth.ts';
import { asyncHandler as h } from '../../core/asyncHandler.ts';
import { signedIn, type AppModule } from '../../core/module.ts';
import { idParam, validate } from '../../core/validate.ts';
import { customerSiteWorkSchema } from './customerSiteWork.schema.ts';
import * as service from './customerSiteWork.service.ts';

const router = Router();
router.use(...signedIn);
router.get('/options', h(async (req, res) => res.json(await service.options(currentUser(req)))));
router.get('/team', h(async (req, res) => res.json(await service.team(currentUser(req)))));
router.get('/', h(async (req, res) => res.json(await service.list(currentUser(req)))));
router.get('/:id/executions', h(async (req, res) => res.json(await service.listExecutions(currentUser(req), idParam(req, 'id')))));
router.post('/', validate(customerSiteWorkSchema), h(async (req, res) => res.status(201).json(await service.create(currentUser(req), req.body))));

export const customerSiteWorkModule: AppModule = {
  name: 'customer-site-work',
  routes: [{ path: '/api/org/customer-site-works', router }],
};
