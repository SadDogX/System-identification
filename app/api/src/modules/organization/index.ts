import { Router } from 'express';
import { accountRolesSchema, addendumSchema, assignmentSchema, baseSchema, baseUpdateSchema, contractPermissionSchema, contractSchema, customerSchema, customerUpdateSchema, employeeProfileSchema, mineCoordinatorSchema, mineSchema, statusCatalogSchema, statusCatalogUpdateSchema, wellContractBasisSchema, wellSchema, workAssignmentSchema, workAssignmentStatusSchema, workAuthorizationSchema, workExecutionSchema, workTypeSchema, workTypeUpdateSchema } from './schemas.ts';
import { adminOnly, signedIn, type AppModule } from '../../core/module.ts';
import { asyncHandler as h } from '../../core/asyncHandler.ts';
import { validate } from '../../core/validate.ts';
import * as controller from './organization.controller.ts';

const organization = Router();
organization.use(...signedIn);
organization.get('/bases', h(controller.listBases));
organization.get('/employees', h(controller.listEmployees));
organization.get('/mines', h(controller.listMines));
organization.get('/mines/:mineId/wells', h(controller.listWells));
organization.get('/bases/:baseId/contracts', h(controller.listContracts));
organization.get('/customers', h(controller.listCustomers));
organization.get('/work-types', h(controller.listWorkTypes));
organization.get('/positions', h(controller.listPositions));
organization.get('/roles', h(controller.listRoles));
organization.get('/statuses/:category', h(controller.listStatuses));
organization.get('/users/:userId/employee', h(controller.getEmployee));
organization.get('/employees/:employeeId/history', h(controller.employeeHistory));
organization.post('/bases/:baseId/mines', validate(mineSchema), h(controller.createMine));
organization.post('/mines/:mineId/wells', validate(wellSchema), h(controller.createWell));
organization.patch('/employees/:employeeId/profile', validate(employeeProfileSchema), h(controller.updateEmployeeProfile));
organization.get('/work-assignments', h(controller.listWorkAssignments));
organization.post('/work-assignments', validate(workAssignmentSchema), h(controller.createWorkAssignment));
organization.patch('/work-assignments/:workAssignmentId', validate(workAssignmentSchema), h(controller.updateWorkAssignment));
organization.patch('/work-assignments/:workAssignmentId/status', validate(workAssignmentStatusSchema), h(controller.updateWorkAssignmentStatus));
organization.post('/employees/:employeeId/assignments', validate(assignmentSchema), h(controller.assignEmployee));
organization.post('/mines/:mineId/coordinator', validate(mineCoordinatorSchema), h(controller.assignMineCoordinator));
organization.post('/work/authorize', validate(workAuthorizationSchema), h(controller.authorizeWork));
organization.post('/customers', validate(customerSchema), h(controller.createCustomer));
organization.post('/bases/:baseId/contracts', validate(contractSchema), h(controller.createContract));
organization.post('/contracts/:contractId/addenda', validate(addendumSchema), h(controller.createAddendum));
organization.put('/contracts/:contractId/work-permissions', validate(contractPermissionSchema), h(controller.setContractPermission));
organization.put('/contracts/:contractId/addenda/:addendumId/work-permissions', validate(contractPermissionSchema), h(controller.setAddendumPermission));
organization.post('/wells/:wellId/contract-bases', validate(wellContractBasisSchema), h(controller.assignWellBasis));
organization.post('/work', validate(workExecutionSchema), h(controller.recordWork));

const admin = Router();
admin.use(...adminOnly);
admin.get('/roles', h(controller.listRoles));
admin.get('/employees', h(controller.listEmployees));
admin.post('/bases', validate(baseSchema), h(controller.createBase));
admin.patch('/bases/:baseId', validate(baseUpdateSchema), h(controller.updateBase));
admin.get('/customers', h(controller.listAdminCustomers));
admin.patch('/customers/:customerId', validate(customerUpdateSchema), h(controller.updateCustomer));
admin.get('/work-types', h(controller.listAdminWorkTypes));
admin.patch('/work-types/:workTypeId', validate(workTypeUpdateSchema), h(controller.updateWorkType));
admin.put('/users/:userId/roles', validate(accountRolesSchema), h(controller.setAccountRoles));
admin.post('/statuses', validate(statusCatalogSchema), h(controller.createStatus));
admin.patch('/statuses/:category/:id', validate(statusCatalogUpdateSchema), h(controller.updateStatus));
admin.post('/work-types', validate(workTypeSchema), h(controller.createWorkType));

export const organizationModule: AppModule = {
  name: 'organization',
  routes: [
    { path: '/api/org', router: organization },
    { path: '/api/admin/org', router: admin },
  ],
};
