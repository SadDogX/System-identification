import { Router } from 'express';
import { positionSchema } from '@app/shared';
import { asyncHandler as h } from '../../core/asyncHandler.ts';
import { adminOnly, type AppModule } from '../../core/module.ts';
import { validate } from '../../core/validate.ts';
import * as controller from './positions.controller.ts';

/** Справочник должностей. */
const router = Router();
router.use(...adminOnly);
router.get('/', h(controller.list));
router.post('/', validate(positionSchema), h(controller.create));
router.put('/:id', validate(positionSchema), h(controller.update));
router.post('/:id/archive', h(controller.archive));
router.post('/:id/unarchive', h(controller.unarchive));

export const positionsModule: AppModule = {
  name: 'positions',
  routes: [{ path: '/api/admin/positions', router }],
};
