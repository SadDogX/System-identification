import { Router } from 'express';
import { catalogItemSchema } from '@app/shared';
import { asyncHandler as h } from '../../core/asyncHandler.ts';
import { adminOnly, type AppModule } from '../../core/module.ts';
import { validate } from '../../core/validate.ts';
import * as controller from './catalog.controller.ts';

/** Справочник удостоверений: название и срок действия. */
const router = Router();
router.use(...adminOnly);
router.get('/', h(controller.list));
router.post('/', validate(catalogItemSchema), h(controller.create));
router.put('/:id', validate(catalogItemSchema), h(controller.update));
router.post('/:id/archive', h(controller.archive));
router.post('/:id/unarchive', h(controller.unarchive));

export const catalogModule: AppModule = {
  name: 'catalog',
  routes: [{ path: '/api/admin/catalog', router }],
};
