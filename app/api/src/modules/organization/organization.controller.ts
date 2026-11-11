import type { Request, Response } from 'express';
import { badRequest } from '../../core/errors.ts';
import { currentUser } from '../../core/auth.ts';
import { idParam } from '../../core/validate.ts';
import * as service from './organization.service.ts';

const categories = ['assignment', 'contract', 'addendum', 'work'] as const;

function categoryParam(req: Request) {
  const category = req.params.category;
  if (!categories.includes(category as (typeof categories)[number])) throw badRequest('Неизвестный справочник статусов');
  return category as (typeof categories)[number];
}

export async function listBases(req: Request, res: Response) {
  res.json(await service.listBases(currentUser(req)));
}

export async function listEmployees(req: Request, res: Response) {
  res.json(await service.listEmployees(currentUser(req)));
}

export async function listMines(req: Request, res: Response) {
  res.json(await service.listMines(currentUser(req)));
}

export async function listWells(req: Request, res: Response) {
  res.json(await service.listWells(currentUser(req), idParam(req, 'mineId')));
}

export async function listCustomerSiteWorksForWell(req: Request, res: Response) {
  res.json(await service.listCustomerSiteWorksForWell(currentUser(req), idParam(req, 'wellId')));
}

export async function listContracts(req: Request, res: Response) {
  res.json(await service.listContracts(currentUser(req), idParam(req, 'baseId')));
}

export async function listCustomers(req: Request, res: Response) {
  res.json(await service.listCustomers(currentUser(req)));
}

export async function listWorkTypes(req: Request, res: Response) {
  res.json(await service.listWorkTypes(currentUser(req)));
}

export async function createBase(req: Request, res: Response) {
  res.status(201).json(await service.createBase(currentUser(req), req.body));
}

export async function updateBase(req: Request, res: Response) {
  res.json(await service.updateBase(currentUser(req), idParam(req, 'baseId'), req.body));
}

export async function createCustomer(req: Request, res: Response) {
  res.status(201).json(await service.createCustomer(currentUser(req), req.body));
}

export async function listAdminCustomers(_req: Request, res: Response) {
  res.json(await service.listAdminCustomers());
}

export async function updateCustomer(req: Request, res: Response) {
  res.json(await service.updateCustomer(currentUser(req), idParam(req, 'customerId'), req.body));
}

export async function createContract(req: Request, res: Response) {
  res.status(201).json(await service.createContract(currentUser(req), idParam(req, 'baseId'), req.body));
}

export async function updateContract(req: Request, res: Response) {
  res.json(await service.updateContract(currentUser(req), idParam(req, 'contractId'), req.body));
}

export async function listContractDocuments(req: Request, res: Response) {
  res.json(await service.listContractDocuments(currentUser(req), idParam(req, 'contractId')));
}

export async function uploadContractDocument(req: Request, res: Response) {
  let fileName: string;
  try {
    fileName = decodeURIComponent(req.header('X-File-Name') ?? '');
  } catch {
    throw badRequest('Имя файла имеет неверный формат');
  }
  res.status(201).json(await service.uploadContractDocument(currentUser(req), idParam(req, 'contractId'), fileName, req.body));
}

export async function downloadContractDocument(req: Request, res: Response) {
  const document = await service.getContractDocument(currentUser(req), idParam(req, 'contractId'), idParam(req, 'documentId'));
  res.setHeader('Content-Type', document.mime);
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(document.name)}`);
  res.sendFile(document.path);
}

export async function deleteContractDocument(req: Request, res: Response) {
  await service.deleteContractDocument(currentUser(req), idParam(req, 'contractId'), idParam(req, 'documentId'));
  res.status(204).end();
}

export async function createAddendum(req: Request, res: Response) {
  res.status(201).json(await service.createAddendum(currentUser(req), idParam(req, 'contractId'), req.body));
}

export async function createWorkType(req: Request, res: Response) {
  res.status(201).json(await service.createWorkType(currentUser(req), req.body));
}

export async function listAdminWorkTypes(_req: Request, res: Response) {
  res.json(await service.listAdminWorkTypes());
}

export async function updateWorkType(req: Request, res: Response) {
  res.json(await service.updateWorkType(currentUser(req), idParam(req, 'workTypeId'), req.body));
}

export async function setContractPermission(req: Request, res: Response) {
  res.json(await service.setContractPermission(currentUser(req), idParam(req, 'contractId'), req.body));
}

export async function setAddendumPermission(req: Request, res: Response) {
  res.json(
    await service.setContractPermission(
      currentUser(req),
      idParam(req, 'contractId'),
      req.body,
      idParam(req, 'addendumId'),
    ),
  );
}

export async function assignWellBasis(req: Request, res: Response) {
  res.status(201).json(await service.assignWellBasis(currentUser(req), idParam(req, 'wellId'), req.body));
}

export async function assignWellBases(req: Request, res: Response) {
  res.status(201).json(await service.assignWellBases(currentUser(req), req.body));
}

export async function recordWork(req: Request, res: Response) {
  res.status(201).json(await service.recordWork(currentUser(req), req.body));
}

export async function createMine(req: Request, res: Response) {
  res.status(201).json(await service.createMine(currentUser(req), idParam(req, 'baseId'), req.body));
}

export async function createWell(req: Request, res: Response) {
  res.status(201).json(await service.createWell(currentUser(req), idParam(req, 'mineId'), req.body));
}

export async function updateEmployeeProfile(req: Request, res: Response) {
  res.json(await service.updateEmployeeProfile(currentUser(req), idParam(req, 'employeeId'), req.body));
}

export async function listStatuses(req: Request, res: Response) {
  res.json(await service.listStatuses(categoryParam(req)));
}

export async function createStatus(req: Request, res: Response) {
  res.status(201).json(await service.createStatus(currentUser(req), req.body));
}

export async function updateStatus(req: Request, res: Response) {
  res.json(await service.updateStatus(currentUser(req), categoryParam(req), idParam(req), req.body));
}

export async function setAccountRoles(req: Request, res: Response) {
  res.json(await service.setAccountRoles(currentUser(req), idParam(req, 'userId'), req.body));
}

export async function assignEmployee(req: Request, res: Response) {
  res.status(201).json(await service.assignEmployee(currentUser(req), idParam(req, 'employeeId'), req.body));
}

export async function assignMineCoordinator(req: Request, res: Response) {
  res.status(201).json(await service.assignMineCoordinator(currentUser(req), idParam(req, 'mineId'), req.body));
}

export async function authorizeWork(req: Request, res: Response) {
  res.json(await service.authorizeWork(currentUser(req), req.body));
}

export async function getEmployee(req: Request, res: Response) {
  res.json(await service.getEmployee(currentUser(req), idParam(req, 'userId')));
}

export async function employeeHistory(req: Request, res: Response) {
  res.json(await service.employeeHistory(currentUser(req), idParam(req, 'employeeId')));
}

export async function listRoles(_req: Request, res: Response) {
  res.json(await service.listRoles());
}

export async function listPositions(_req: Request, res: Response) {
  res.json(await service.listPositions());
}
