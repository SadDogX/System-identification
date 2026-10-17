import express, { Router } from 'express';
import { PHOTO_MAX_BYTES } from '@app/shared';
import { authenticate, requirePasswordChanged } from '../middleware/auth.ts';
import { asyncHandler as h } from '../utils/asyncHandler.ts';
import * as photos from '../controllers/photos.controller.ts';

/**
 * Фото и сканы удостоверений. Сотрудник — только к своим записям, администратор — к любым
 * (проверка в photos.service). Файл приходит «как есть» в теле запроса, тип определяется по содержимому.
 */
export const credentialsRouter = Router();

credentialsRouter.use(authenticate, requirePasswordChanged);

credentialsRouter.get('/:id/photo', h(photos.download));
credentialsRouter.put('/:id/photo', express.raw({ type: () => true, limit: PHOTO_MAX_BYTES }), h(photos.upload));
credentialsRouter.delete('/:id/photo', h(photos.remove));
