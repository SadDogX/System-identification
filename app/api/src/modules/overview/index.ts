import { Router, type Request, type Response } from 'express';
import { overviewQuerySchema } from '@app/shared';
import { asyncHandler as h } from '../../core/asyncHandler.ts';
import { adminOnly, type AppModule } from '../../core/module.ts';
import { validQuery, validate } from '../../core/validate.ts';
import { getOverview } from './overview.service.ts';

/** «Общие сведения»: сотрудники × удостоверения со сроками. */
const router = Router();
router.use(...adminOnly);
router.get(
  '/',
  validate(overviewQuerySchema, 'query'),
  h(async (req: Request, res: Response) => {
    res.json(await getOverview(validQuery(req)));
  }),
);

export const overviewModule: AppModule = {
  name: 'overview',
  routes: [{ path: '/api/admin/overview', router }],
};
