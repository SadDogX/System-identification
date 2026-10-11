import request from 'supertest';
import bcrypt from 'bcryptjs';
import type { Role } from '@prisma/client';
import { createApp } from '../src/app';
import { prisma } from '../src/db';

export const app = createApp();
export const api = () => request(app);

export const PASSWORD = 'password123';
const passwordHash = bcrypt.hashSync(PASSWORD, 4);

export async function resetDb() {
  // Порядок важен из-за внешних ключей
  await prisma.notification.deleteMany();
  await prisma.message.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.userCredential.deleteMany();
  await prisma.credential.deleteMany();
  await prisma.user.deleteMany();
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
  const res = await api().post('/api/auth/login').send({ login, password: PASSWORD });
  if (res.status !== 200) throw new Error(`Не удалось войти: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.accessToken;
}

export const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
