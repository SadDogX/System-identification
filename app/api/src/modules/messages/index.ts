import { Router } from 'express';
import { paginationQuerySchema, sendMessageSchema } from '@app/shared';
import { asyncHandler as h } from '../../core/asyncHandler.ts';
import { adminOnly, type AppModule } from '../../core/module.ts';
import { validate } from '../../core/validate.ts';
import * as controller from './messages.controller.ts';

/** Сообщения администратора: конкретному сотруднику или всем (broadcast). */
const router = Router();
router.use(...adminOnly);
router.get('/', validate(paginationQuerySchema, 'query'), h(controller.history));
router.post('/', validate(sendMessageSchema), h(controller.send));

export const messagesModule: AppModule = {
  name: 'messages',
  routes: [{ path: '/api/admin/messages', router }],
};
