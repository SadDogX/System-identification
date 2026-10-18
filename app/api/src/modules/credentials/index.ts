import express, { Router } from 'express';
import { PHOTO_MAX_BYTES, adminCredentialUpdateSchema, credentialListQuerySchema, userCredentialUpdateSchema } from '@app/shared';
import { requireRole } from '../../core/auth.ts';
import { asyncHandler as h } from '../../core/asyncHandler.ts';
import { adminOnly, signedIn, type AppModule } from '../../core/module.ts';
import { validate } from '../../core/validate.ts';
import * as credentials from './credentials.controller.ts';
import * as photos from './photos.controller.ts';

/** Удостоверения всех сотрудников — у администратора. */
const admin = Router();
admin.use(...adminOnly);
admin.get('/', validate(credentialListQuerySchema, 'query'), h(credentials.list));
admin.patch('/:id', validate(adminCredentialUpdateSchema), h(credentials.update));
admin.post('/:id/clear', h(credentials.clear));
admin.post('/:id/mark-deletion', h(credentials.mark));
admin.post('/:id/unmark-deletion', h(credentials.unmark));

/** Свои удостоверения сотрудника: только дата выдачи и очистка. */
const own = Router();
own.use(...signedIn, requireRole('USER'));
own.get('/', h(credentials.listOwn));
own.patch('/:id', validate(userCredentialUpdateSchema), h(credentials.updateOwn));
own.post('/:id/clear', h(credentials.clearOwn));

/**
 * Фото и сканы. Сотрудник — только к своим записям, администратор — к любым
 * (проверка в photos.service). Файл приходит «как есть» в теле запроса, тип определяется по содержимому.
 */
const photo = Router();
photo.use(...signedIn);
photo.get('/:id/photo', h(photos.download));
photo.put('/:id/photo', express.raw({ type: () => true, limit: PHOTO_MAX_BYTES }), h(photos.upload));
photo.delete('/:id/photo', h(photos.remove));

export const credentialsModule: AppModule = {
  name: 'credentials',
  routes: [
    { path: '/api/admin/credentials', router: admin },
    { path: '/api/me/credentials', router: own },
    { path: '/api/credentials', router: photo },
  ],
};
