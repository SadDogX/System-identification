import { Router, type Request, type Response } from 'express';
import { auditListQuerySchema } from '@app/shared';
import { asyncHandler as h } from '../../core/asyncHandler.ts';
import { adminOnly, type AppModule } from '../../core/module.ts';
import { validQuery, validate } from '../../core/validate.ts';
import * as auditLog from './auditLog.service.ts';

/** Журнал действий: кто, что и когда изменил. Запись в журнал — core/audit.ts. */
const router = Router();
router.use(...adminOnly);
router.get(
  '/',
  validate(auditListQuerySchema, 'query'),
  h(async (req: Request, res: Response) => {
    res.json(await auditLog.list(validQuery(req)));
  }),
);

export const auditModule: AppModule = {
  name: 'audit',
  routes: [{ path: '/api/admin/audit-log', router }],
};
