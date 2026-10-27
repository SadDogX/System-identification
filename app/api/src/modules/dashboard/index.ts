import { Router, type Request, type Response } from 'express';
import { currentUser } from '../../core/auth.ts';
import { asyncHandler as h } from '../../core/asyncHandler.ts';
import { signedIn, type AppModule } from '../../core/module.ts';
import { getDashboard } from './dashboard.service.ts';

/** Дашборд администратора: счётчики по статусам, ближайшие истечения, последние изменения. */
const router = Router();
router.use(...signedIn);
router.get(
  '/',
  h(async (req: Request, res: Response) => {
    res.json(await getDashboard(currentUser(req)));
  }),
);

export const dashboardModule: AppModule = {
  name: 'dashboard',
  routes: [{ path: '/api/admin/dashboard', router }],
};
