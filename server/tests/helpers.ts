import { execSync } from 'node:child_process';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import type { Role } from '@prisma/client';
import { createApp } from '../src/app.ts';
import { prisma } from '../src/db.ts';
import { hashPassword } from '../src/utils/password.ts';

export const PASSWORD = 'password123';
const passwordHash = await hashPassword(PASSWORD);

let server: Server;
let baseUrl = '';

/** Пересоздаёт схему тестовой БД (DATABASE_URL из .env.test) и поднимает сервер на свободном порту. */
export async function startServer() {
  if (!process.env.DATABASE_URL?.includes('_test')) {
    throw new Error('Тесты запускаются только на тестовой БД (имя должно содержать _test)');
  }
  execSync('npx prisma db push --force-reset --skip-generate', { stdio: 'ignore', env: process.env });
  server = createApp().listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

/** Полный адрес для запросов, которым нужен сырой fetch (cookie). */
export const url = (path: string) => baseUrl + path;

export async function stopServer() {
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
  await prisma.userCredential.deleteMany();
  await prisma.credential.deleteMany();
  await prisma.user.deleteMany();
  await prisma.position.deleteMany();
  await prisma.setting.deleteMany();
}

let counter = 0;

export async function createUser(role: Role = 'USER', overrides: { isActive?: boolean } = {}) {
  counter += 1;
  return prisma.user.create({
    data: {
      fullName: `${role === 'ADMIN' ? 'Админ' : 'Сотрудник'} ${counter}`,
      login: `${role.toLowerCase()}${counter}`,
      passwordHash,
      role,
      mustChangePassword: false,
      ...overrides,
    },
  });
}

export async function tokenFor(login: string): Promise<string> {
  const res = await api('POST', '/api/auth/login', { body: { login, password: PASSWORD } });
  if (res.status !== 200) throw new Error(`Не удалось войти: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.accessToken;
}
