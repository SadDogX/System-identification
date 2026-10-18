import { Router } from 'express';
import { createUserSchema, resetPasswordSchema, uiSettingsSchema, updateProfileSchema, updateUserSchema, userListQuerySchema } from '@app/shared';
import { authenticate, requirePasswordChanged } from '../../core/auth.ts';
import { asyncHandler as h } from '../../core/asyncHandler.ts';
import { adminOnly, type AppModule } from '../../core/module.ts';
import { validate } from '../../core/validate.ts';
import * as users from './users.controller.ts';

/** Пользователи: управление у администратора и собственный профиль. */
const admin = Router();
admin.use(...adminOnly);
admin.get('/', validate(userListQuerySchema, 'query'), h(users.list));
admin.get('/options', h(users.options));
admin.get('/:id', h(users.getOne));
admin.post('/', validate(createUserSchema), h(users.create));
admin.patch('/:id', validate(updateUserSchema), h(users.update));
admin.delete('/:id', h(users.remove));
admin.post('/:id/reset-password', validate(resetPasswordSchema), h(users.resetPassword));

/** Свой профиль. userId всегда берётся из токена, а не из запроса. */
// Проверка входа — на каждом маршруте: под /api/me подключены и другие модули
const me = Router();
// Доступно и до смены временного пароля — клиенту нужно знать, кто вошёл
me.get('/', authenticate, h(users.me));
me.patch('/', authenticate, requirePasswordChanged, validate(updateProfileSchema), h(users.updateProfile));
me.patch('/settings', authenticate, requirePasswordChanged, validate(uiSettingsSchema), h(users.updateUiSettings));

export const usersModule: AppModule = {
  name: 'users',
  routes: [
    { path: '/api/admin/users', router: admin },
    { path: '/api/me', router: me },
  ],
};
