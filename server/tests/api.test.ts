import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { addDays, addMonths, todayInTimezone } from '@app/shared';
import { prisma } from '../src/db';
import { checkExpiryNotifications, createAdminDigest } from '../src/services/notifications.service';
import { api, auth, createUser, resetDb, tokenFor } from './helpers';

const today = () => todayInTimezone('Europe/Moscow');

async function createCatalogItem(adminToken: string, name = 'Охрана труда', validityMonths = 12) {
  const res = await api().post('/api/admin/catalog').set(auth(adminToken)).send({ name, validityMonths });
  expect(res.status).toBe(201);
  return res.body as { id: number };
}

async function setup() {
  const admin = await createUser('ADMIN');
  const adminToken = await tokenFor(admin.login);
  return { admin, adminToken };
}

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

describe('авторизация и доступ', () => {
  it('без токена — 401, USER на /admin — 403', async () => {
    const user = await createUser('USER');
    const token = await tokenFor(user.login);
    expect((await api().get('/api/admin/users')).status).toBe(401);
    expect((await api().get('/api/admin/users').set(auth(token))).status).toBe(403);
    expect((await api().get('/api/admin/dashboard').set(auth(token))).status).toBe(403);
  });

  it('неверный пароль — 401, в ответах нет passwordHash', async () => {
    const user = await createUser('USER');
    const bad = await api().post('/api/auth/login').send({ login: user.login, password: 'wrong-password' });
    expect(bad.status).toBe(401);

    const { adminToken } = await setup();
    const list = await api().get('/api/admin/users').set(auth(adminToken));
    expect(list.status).toBe(200);
    expect(JSON.stringify(list.body)).not.toContain('passwordHash');
    expect(JSON.stringify(list.body)).not.toContain('$2');
  });

  it('заблокированный и удалённый пользователь со старым токеном получает 401', async () => {
    const { adminToken } = await setup();
    const user = await createUser('USER');
    const token = await tokenFor(user.login);
    expect((await api().get('/api/me').set(auth(token))).status).toBe(200);

    await api().patch(`/api/admin/users/${user.id}`).set(auth(adminToken)).send({ isActive: false });
    expect((await api().get('/api/me').set(auth(token))).status).toBe(401);

    const other = await createUser('USER');
    const otherToken = await tokenFor(other.login);
    expect((await api().delete(`/api/admin/users/${other.id}`).set(auth(adminToken))).status).toBe(204);
    expect((await api().get('/api/me').set(auth(otherToken))).status).toBe(401);
  });

  it('временный пароль: до смены доступен только /me', async () => {
    const { adminToken } = await setup();
    const created = await api()
      .post('/api/admin/users')
      .set(auth(adminToken))
      .send({ fullName: 'Петров Пётр', login: 'petrov', password: 'temp-pass-1', role: 'USER' });
    expect(created.status).toBe(201);

    const login = await api().post('/api/auth/login').send({ login: 'petrov', password: 'temp-pass-1' });
    expect(login.body.user.mustChangePassword).toBe(true);
    const token = login.body.accessToken;
    expect((await api().get('/api/me/credentials').set(auth(token))).status).toBe(403);

    const changed = await api()
      .post('/api/auth/change-password')
      .set(auth(token))
      .send({ currentPassword: 'temp-pass-1', newPassword: 'new-pass-123' });
    expect(changed.status).toBe(200);
    // Старый токен отозван, новый работает
    expect((await api().get('/api/me').set(auth(token))).status).toBe(401);
    expect((await api().get('/api/me/credentials').set(auth(changed.body.accessToken))).status).toBe(200);
  });

  it('админ не может удалить себя и разжаловать последнего админа', async () => {
    const { admin, adminToken } = await setup();
    expect((await api().delete(`/api/admin/users/${admin.id}`).set(auth(adminToken))).status).toBe(400);
    expect(
      (await api().patch(`/api/admin/users/${admin.id}`).set(auth(adminToken)).send({ role: 'USER' })).status,
    ).toBe(400);
  });
});

describe('пользователи и справочник', () => {
  it('создание USER создаёт записи по справочнику, ADMIN — не создаёт', async () => {
    const { adminToken } = await setup();
    await createCatalogItem(adminToken, 'А');
    await createCatalogItem(adminToken, 'Б');

    const user = await api()
      .post('/api/admin/users')
      .set(auth(adminToken))
      .send({ fullName: 'Иванов', login: 'ivanov', password: 'password123', role: 'USER' });
    const admin2 = await api()
      .post('/api/admin/users')
      .set(auth(adminToken))
      .send({ fullName: 'Сидоров', login: 'sidorov', password: 'password123', role: 'ADMIN' });

    expect(await prisma.userCredential.count({ where: { userId: user.body.id } })).toBe(2);
    expect(await prisma.userCredential.count({ where: { userId: admin2.body.id } })).toBe(0);
  });

  it('новая позиция справочника появляется у всех сотрудников (backfill)', async () => {
    const { adminToken } = await setup();
    const u1 = await createUser('USER');
    const u2 = await createUser('USER');
    const item = await createCatalogItem(adminToken);
    const rows = await prisma.userCredential.findMany({ where: { credentialId: item.id } });
    expect(rows.map((r) => r.userId).sort()).toEqual([u1.id, u2.id].sort());
  });

  it('логин уникален', async () => {
    const { admin, adminToken } = await setup();
    const res = await api()
      .post('/api/admin/users')
      .set(auth(adminToken))
      .send({ fullName: 'Дубль', login: admin.login, password: 'password123', role: 'USER' });
    expect(res.status).toBe(409);
  });
});

describe('удостоверения', () => {
  async function userWithCredential(validityMonths = 12) {
    const { adminToken, admin } = await setup();
    await createCatalogItem(adminToken, 'Электробезопасность', validityMonths);
    const user = await createUser('USER');
    // Пользователь создан напрямую в БД — создаём записи, как это делает сервис
    const items = await prisma.credential.findMany();
    await prisma.userCredential.createMany({ data: items.map((i) => ({ userId: user.id, credentialId: i.id })) });
    const token = await tokenFor(user.login);
    const [uc] = await prisma.userCredential.findMany({ where: { userId: user.id } });
    return { admin, adminToken, user, token, uc };
  }

  it('сотрудник вводит дату выдачи, дата окончания = выдача + срок (задним числом тоже)', async () => {
    const { token, uc } = await userWithCredential(12);
    const issueDate = '2025-01-31';
    const res = await api().patch(`/api/me/credentials/${uc.id}`).set(auth(token)).send({ issueDate });
    expect(res.status).toBe(200);
    expect(res.body.issueDate).toBe(issueDate);
    expect(res.body.expiryDate).toBe(addMonths(issueDate, 12));
    expect(res.body.status).toBe('RED'); // давно истекло
  });

  it('дата выдачи в будущем запрещена', async () => {
    const { token, uc } = await userWithCredential();
    const res = await api()
      .patch(`/api/me/credentials/${uc.id}`)
      .set(auth(token))
      .send({ issueDate: addDays(today(), 1) });
    expect(res.status).toBe(400);
    expect(res.body.details.issueDate).toBeTruthy();
  });

  it('сотрудник не может изменить номер, комментарий или дату окончания', async () => {
    const { token, uc } = await userWithCredential();
    const res = await api()
      .patch(`/api/me/credentials/${uc.id}`)
      .set(auth(token))
      .send({ issueDate: today(), number: 'X-1', comment: 'взлом', expiryDate: '2099-01-01' });
    expect(res.status).toBe(200);
    const row = await prisma.userCredential.findUniqueOrThrow({ where: { id: uc.id } });
    expect(row.number).toBeNull();
    expect(row.comment).toBeNull();
    expect(row.expiryDate?.toISOString().slice(0, 10)).toBe(addMonths(today(), 12));
  });

  it('IDOR: чужое удостоверение — 404', async () => {
    const { uc } = await userWithCredential();
    const stranger = await createUser('USER');
    const strangerToken = await tokenFor(stranger.login);
    const res = await api().patch(`/api/me/credentials/${uc.id}`).set(auth(strangerToken)).send({ issueDate: today() });
    expect(res.status).toBe(404);
  });

  it('изменение даты пишет журнал с «было/стало»', async () => {
    const { token, uc, user } = await userWithCredential(12);
    await api().patch(`/api/me/credentials/${uc.id}`).set(auth(token)).send({ issueDate: today() });
    const log = await prisma.auditLog.findFirstOrThrow({ where: { action: 'credential.update', targetUserId: user.id } });
    expect(log.diff).toMatchObject({
      issueDate: { from: null, to: today() },
      expiryDate: { from: null, to: addMonths(today(), 12) },
    });
  });

  it('пометка на удаление скрывает запись из списков и статистики, снятие — возвращает', async () => {
    const { adminToken, token, uc } = await userWithCredential();
    const before = await api().get('/api/admin/dashboard').set(auth(adminToken));
    expect(before.body.counts.WHITE).toBe(1);

    expect((await api().post(`/api/admin/credentials/${uc.id}/mark-deletion`).set(auth(adminToken))).status).toBe(200);
    const after = await api().get('/api/admin/dashboard').set(auth(adminToken));
    expect(after.body.counts.WHITE).toBe(0);
    expect((await api().get('/api/me/credentials').set(auth(token))).body).toHaveLength(0);
    const marked = await api().get('/api/admin/credentials?marked=true').set(auth(adminToken));
    expect(marked.body.total).toBe(1);

    await api().post(`/api/admin/credentials/${uc.id}/unmark-deletion`).set(auth(adminToken));
    expect((await api().get('/api/me/credentials').set(auth(token))).body).toHaveLength(1);
  });

  it('фильтр по статусу у админа', async () => {
    const { adminToken, token, uc } = await userWithCredential(12);
    // Выдано 11 месяцев назад → осталось около месяца → жёлтый
    const issueDate = addMonths(today(), -11);
    await api().patch(`/api/me/credentials/${uc.id}`).set(auth(token)).send({ issueDate });
    const yellow = await api().get('/api/admin/credentials?status=YELLOW').set(auth(adminToken));
    const green = await api().get('/api/admin/credentials?status=GREEN').set(auth(adminToken));
    expect(yellow.body.total).toBe(1);
    expect(green.body.total).toBe(0);
  });

  it('очистка данных оставляет запись пустой', async () => {
    const { adminToken, token, uc } = await userWithCredential();
    await api().patch(`/api/me/credentials/${uc.id}`).set(auth(token)).send({ issueDate: today() });
    const res = await api().post(`/api/admin/credentials/${uc.id}/clear`).set(auth(adminToken));
    expect(res.body).toMatchObject({ issueDate: null, expiryDate: null, status: 'WHITE' });
  });
});

describe('сообщения и уведомления', () => {
  it('broadcast получают только активные сотрудники', async () => {
    const { adminToken } = await setup();
    const active = await createUser('USER');
    const blocked = await createUser('USER', { isActive: false });
    const res = await api()
      .post('/api/admin/messages')
      .set(auth(adminToken))
      .send({ recipient: 'all', subject: 'Собрание', body: 'В пятницу в 10:00' });
    expect(res.status).toBe(201);
    expect(res.body.recipientsCount).toBe(1);
    expect(await prisma.notification.count({ where: { userId: active.id, kind: 'MESSAGE' } })).toBe(1);
    expect(await prisma.notification.count({ where: { userId: blocked.id } })).toBe(0);

    const token = await tokenFor(active.login);
    expect((await api().get('/api/me/notifications/unread-count').set(auth(token))).body.count).toBe(1);
    await api().post('/api/me/notifications/read-all').set(auth(token));
    expect((await api().get('/api/me/notifications/unread-count').set(auth(token))).body.count).toBe(0);
  });

  it('проверка сроков не плодит дубли, сводка админу — одна в день', async () => {
    const { adminToken, admin } = await setup();
    await createCatalogItem(adminToken, 'Медосмотр', 12);
    const user = await createUser('USER');
    const [item] = await prisma.credential.findMany();
    // Истекает через 5 дней
    const expiry = addDays(today(), 5);
    await prisma.userCredential.create({
      data: { userId: user.id, credentialId: item.id, issueDate: new Date(`${addMonths(expiry, -12)}T00:00:00Z`), expiryDate: new Date(`${expiry}T00:00:00Z`) },
    });

    await checkExpiryNotifications();
    await checkExpiryNotifications();
    expect(await prisma.notification.count({ where: { userId: user.id, kind: 'EXPIRY' } })).toBe(1);
    const n = await prisma.notification.findFirstOrThrow({ where: { userId: user.id } });
    expect(n.level).toBe('RED');

    await createAdminDigest();
    await createAdminDigest();
    expect(await prisma.notification.count({ where: { userId: admin.id, kind: 'DIGEST' } })).toBe(1);
  });
});
