import { execSync } from 'node:child_process';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import type { Role } from '@prisma/client';
import { createApp } from '../src/app.ts';
import { prisma } from '../src/core/db.ts';
import { hashPassword } from '../src/core/password.ts';
import { ensureEmployeeAndLegacyRole, initializeOrganizationCatalog } from '../src/modules/organization/organization.service.ts';

export const PASSWORD = 'password123';
const passwordHash = await hashPassword(PASSWORD);

let server: Server;
let baseUrl = '';

/** Синхронизирует схему тестовой БД и поднимает сервер на свободном порту. */
export async function startServer() {
  if (!process.env.DATABASE_URL?.includes('_test')) {
    throw new Error('Тесты запускаются только на тестовой БД (имя должно содержать _test)');
  }
  execSync('npx prisma db push', { stdio: 'ignore', env: process.env });
  await initializeOrganizationCatalog();
  server = createApp().listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

/** Полный адрес для запросов, которым нужен сырой fetch (cookie). */
export const url = (path: string) => baseUrl + path;

export async function stopServer() {
  if (!server) {
    await prisma.$disconnect();
    return;
  }
  await new Promise((resolve) => server.close(resolve));
  await prisma.$disconnect();
}

export interface ApiResponse {
  status: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: any;
}

export async function api(
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  path: string,
  opts: { token?: string; body?: unknown } = {},
): Promise<ApiResponse> {
  const res = await fetch(baseUrl + path, {
    method,
    headers: {
      ...(opts.body !== undefined && { 'Content-Type': 'application/json' }),
      ...(opts.token && { Authorization: `Bearer ${opts.token}` }),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

export async function resetDb() {
  // Порядок важен из-за внешних ключей
  await prisma.notification.deleteMany();
  await prisma.message.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.workExecutionResponsible.deleteMany();
  await prisma.workExecution.deleteMany();
  await prisma.contractWorkPermission.deleteMany();
  await prisma.addendumWorkPermission.deleteMany();
  await prisma.wellContractBasis.deleteMany();
  await prisma.workType.deleteMany();
  await prisma.contractAddendum.deleteMany();
  await prisma.contract.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.mineCoordinatorAssignment.deleteMany();
  await prisma.well.deleteMany();
  await prisma.mine.deleteMany();
  await prisma.organizationChange.deleteMany();
  await prisma.employeeAssignment.deleteMany();
  await prisma.base.deleteMany();
  await prisma.userSystemRole.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.userCredential.deleteMany();
  await prisma.credential.deleteMany();
  await prisma.user.deleteMany();
  await prisma.position.deleteMany();
  await prisma.setting.deleteMany();
}

let counter = 0;

export async function createUser(role: Role = 'USER', overrides: { isActive?: boolean } = {}) {
  counter += 1;
  const user = await prisma.user.create({
    data: {
      fullName: `${role === 'ADMIN' ? 'Админ' : 'Сотрудник'} ${counter}`,
      login: `${role.toLowerCase()}${counter}`,
      passwordHash,
      role,
      mustChangePassword: false,
      ...overrides,
    },
  });
  await prisma.$transaction((tx) => ensureEmployeeAndLegacyRole(tx, user));
  return user;
}

export async function tokenFor(login: string): Promise<string> {
  const res = await api('POST', '/api/auth/login', { body: { login, password: PASSWORD } });
  if (res.status !== 200) throw new Error(`Не удалось войти: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.accessToken;
}
