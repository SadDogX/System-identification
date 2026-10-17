import { Router } from 'express';
import {
  adminCredentialUpdateSchema,
  auditListQuerySchema,
  catalogItemSchema,
  createUserSchema,
  credentialListQuerySchema,
  overviewQuerySchema,
  paginationQuerySchema,
  positionSchema,
  resetPasswordSchema,
  sendMessageSchema,
  updateUserSchema,
  userListQuerySchema,
} from '@app/shared';
import { authenticate, requirePasswordChanged, requireRole } from '../middleware/auth.ts';
import { validate } from '../middleware/validate.ts';
import { asyncHandler as h } from '../utils/asyncHandler.ts';
import * as admin from '../controllers/admin.controller.ts';

export const adminRouter = Router();

adminRouter.use(authenticate, requirePasswordChanged, requireRole('ADMIN'));

adminRouter.get('/dashboard', h(admin.dashboard));

adminRouter.get('/users', validate(userListQuerySchema, 'query'), h(admin.listUsers));
adminRouter.get('/users/options', h(admin.userOptions));
adminRouter.get('/users/:id', h(admin.getUser));
adminRouter.post('/users', validate(createUserSchema), h(admin.createUser));
adminRouter.patch('/users/:id', validate(updateUserSchema), h(admin.updateUser));
adminRouter.delete('/users/:id', h(admin.deleteUser));
adminRouter.post('/users/:id/reset-password', validate(resetPasswordSchema), h(admin.resetPassword));

adminRouter.get('/catalog', h(admin.listCatalog));
adminRouter.post('/catalog', validate(catalogItemSchema), h(admin.createCatalogItem));
adminRouter.put('/catalog/:id', validate(catalogItemSchema), h(admin.updateCatalogItem));
adminRouter.post('/catalog/:id/archive', h(admin.archiveCatalogItem));
adminRouter.post('/catalog/:id/unarchive', h(admin.unarchiveCatalogItem));

adminRouter.get('/credentials', validate(credentialListQuerySchema, 'query'), h(admin.listCredentials));
adminRouter.patch('/credentials/:id', validate(adminCredentialUpdateSchema), h(admin.updateCredential));
adminRouter.post('/credentials/:id/clear', h(admin.clearCredential));
adminRouter.post('/credentials/:id/mark-deletion', h(admin.markCredential));
adminRouter.post('/credentials/:id/unmark-deletion', h(admin.unmarkCredential));

adminRouter.get('/messages', validate(paginationQuerySchema, 'query'), h(admin.messageHistory));
adminRouter.post('/messages', validate(sendMessageSchema), h(admin.sendMessage));

adminRouter.get('/audit-log', validate(auditListQuerySchema, 'query'), h(admin.listAuditLog));

adminRouter.get('/overview', validate(overviewQuerySchema, 'query'), h(admin.overview));

adminRouter.get('/positions', h(admin.listPositions));
adminRouter.post('/positions', validate(positionSchema), h(admin.createPosition));
adminRouter.put('/positions/:id', validate(positionSchema), h(admin.updatePosition));
adminRouter.post('/positions/:id/archive', h(admin.archivePosition));
adminRouter.post('/positions/:id/unarchive', h(admin.unarchivePosition));
