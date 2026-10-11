import { Router } from 'express';
import { uiSettingsSchema, updateProfileSchema, userCredentialUpdateSchema } from '@app/shared';
import { authenticate, requirePasswordChanged, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { asyncHandler as h } from '../utils/asyncHandler';
import * as me from '../controllers/me.controller';

/** Собственные данные. userId всегда берётся из токена, а не из запроса. */
export const meRouter = Router();

meRouter.use(authenticate);

// Доступно и до смены временного пароля — клиенту нужно знать, кто вошёл
meRouter.get('/', h(me.getMe));

meRouter.use(requirePasswordChanged);

meRouter.patch('/', validate(updateProfileSchema), h(me.updateProfile));
meRouter.patch('/settings', validate(uiSettingsSchema), h(me.updateUiSettings));

meRouter.get('/credentials', requireRole('USER'), h(me.listCredentials));
meRouter.patch('/credentials/:id', requireRole('USER'), validate(userCredentialUpdateSchema), h(me.updateCredential));

meRouter.get('/notifications', validate(me.notificationsQuerySchema, 'query'), h(me.listNotifications));
meRouter.get('/notifications/unread-count', h(me.unreadCount));
meRouter.post('/notifications/read-all', h(me.markAllRead));
meRouter.patch('/notifications/:id/read', h(me.markRead));
