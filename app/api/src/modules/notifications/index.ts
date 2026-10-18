import { Router } from 'express';
import { notificationsQuerySchema } from '@app/shared';
import { asyncHandler as h } from '../../core/asyncHandler.ts';
import { signedIn, type AppModule } from '../../core/module.ts';
import { validate } from '../../core/validate.ts';
import * as controller from './notifications.controller.ts';
import { scheduleExpiryCheck } from './expiryCheck.job.ts';

/** Центр уведомлений (свои уведомления и сообщения) и ежедневная проверка сроков. */
const router = Router();
router.use(...signedIn);
router.get('/', validate(notificationsQuerySchema, 'query'), h(controller.list));
router.get('/unread-count', h(controller.unreadCount));
router.post('/read-all', h(controller.markAllRead));
router.post('/dismiss-read', h(controller.dismissRead));
router.patch('/:id/read', h(controller.markRead));

export const notificationsModule: AppModule = {
  name: 'notifications',
  routes: [{ path: '/api/me/notifications', router }],
  startJobs: scheduleExpiryCheck,
};
