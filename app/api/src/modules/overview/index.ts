import { Router, type Request, type Response } from 'express';
import { overviewQuerySchema } from '@app/shared';
import { asyncHandler as h } from '../../core/asyncHandler.ts';
import { signedIn, type AppModule } from '../../core/module.ts';
import { currentUser } from '../../core/auth.ts';
import { validQuery, validate } from '../../core/validate.ts';
import { getOverview } from './overview.service.ts';

/** «Общие сведения»: сотрудники × удостоверения со сроками. */
const router = Router();
router.use(...signedIn);
router.get(
  '/',
  validate(overviewQuerySchema, 'query'),
  h(async (req: Request, res: Response) => {
    res.json(await getOverview(currentUser(req), validQuery(req)));
  }),
);

export const overviewModule: AppModule = {
  name: 'overview',
  routes: [{ path: '/api/admin/overview', router }],
};
