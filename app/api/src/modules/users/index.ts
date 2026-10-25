import express, { Router } from 'express';
import * as profilePhoto from './profilePhoto.service.ts';
import { createUserSchema, resetPasswordSchema, uiSettingsSchema, updateProfileSchema, updateUserSchema, userListQuerySchema } from '@app/shared';
import { authenticate, currentUser, requirePasswordChanged } from '../../core/auth.ts';
import { asyncHandler as h } from '../../core/asyncHandler.ts';
import { adminOnly, type AppModule } from '../../core/module.ts';
import { validate } from '../../core/validate.ts';
import * as users from './users.controller.ts';

/** Пользователи: управление у администратора и собственный профиль. */
const admin = Router();
admin.use(...adminOnly);
admin.get('/', validate(userListQuerySchema, 'query'), h(users.list));
admin.get('/options', h(users.options));
admin.get('/archive', h(users.archive));
admin.get('/:id/dependencies', h(users.dependencies));
admin.post('/:id/unlock', h(users.unlock));
admin.post('/:id/restore', h(users.restore));
admin.get('/:id', h(users.getOne));
admin.post('/', validate(createUserSchema), h(users.create));
admin.patch('/:id', validate(updateUserSchema), h(users.update));
admin.delete('/:id', h(users.remove));
admin.post('/:id/reset-password', validate(resetPasswordSchema), h(users.resetPassword));

/** Свой профиль. userId всегда берётся из токена, а не из запроса. */
// Проверка входа — на каждом маршруте: под /api/me подключены и другие модули
const me = Router();
const photo = Router();
photo.put('/', authenticate, express.raw({ type: () => true, limit: '5mb' }), h(async (req, res) => res.json(await profilePhoto.save(currentUser(req), req.body))));
photo.get('/', authenticate, h(async (req, res) => { const file = await profilePhoto.get(currentUser(req)); res.setHeader('Content-Type', file.mime); res.sendFile(file.path); }));
photo.delete('/', authenticate, h(async (req, res) => { await profilePhoto.remove(currentUser(req)); res.status(204).end(); }));

// Доступно и до смены временного пароля — клиенту нужно знать, кто вошёл
me.get('/', authenticate, h(users.me));
me.patch('/', authenticate, requirePasswordChanged, validate(updateProfileSchema), h(users.updateProfile));
me.patch('/settings', authenticate, requirePasswordChanged, validate(uiSettingsSchema), h(users.updateUiSettings));

export const usersModule: AppModule = {
  name: 'users',
  routes: [
    { path: '/api/admin/users', router: admin },
    { path: '/api/me/profile-photo', router: photo },
    { path: '/api/me', router: me },
  ],
};
