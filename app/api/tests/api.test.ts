import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, addMonths, todayInTimezone } from '@app/shared';
import { prisma } from '../src/core/db.ts';
import { checkExpiryNotifications } from '../src/modules/notifications/notifications.service.ts';
import { signJwt, verifyJwt } from '../src/core/jwt.ts';
import { hashPassword, verifyPassword } from '../src/core/password.ts';
import { api, createUser, resetDb, startServer, stopServer, tokenFor, url } from './helpers.ts';

const today = () => todayInTimezone('Europe/Moscow');

async function createCatalogItem(token: string, name = 'Охрана труда', validityMonths = 12) {
  const res = await api('POST', '/api/admin/catalog', { token, body: { name, validityMonths } });
  assert.equal(res.status, 201);
  return res.body as { id: number };
}

async function setup() {
  const admin = await createUser('ADMIN');
  const adminToken = await tokenFor(admin.login);
  return { admin, adminToken };
}

before(startServer);
after(stopServer);
beforeEach(resetDb);

describe('криптография', () => {
  it('пароль: scrypt-хеш проверяется, чужой пароль — нет', async () => {
    const hash = await hashPassword('секрет-123');
    assert.ok(hash.startsWith('scrypt$'));
    assert.equal(await verifyPassword('секрет-123', hash), true);
    assert.equal(await verifyPassword('секрет-124', hash), false);
  });

  it('JWT: подделанная подпись, alg=none и истёкший токен отклоняются', () => {
    const token = signJwt({ sub: 1, role: 'USER' }, 'secret', 60);
    assert.equal(verifyJwt<{ sub: number }>(token, 'secret')?.sub, 1);
    assert.equal(verifyJwt(token, 'other-secret'), null);

    const [, , signature] = token.split('.');
    const forgedBody = Buffer.from(JSON.stringify({ sub: 1, role: 'ADMIN', exp: 9999999999 })).toString('base64url');
    const header = token.split('.')[0];
    assert.equal(verifyJwt(`${header}.${forgedBody}.${signature}`, 'secret'), null);

    const none = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    assert.equal(verifyJwt(`${none}.${forgedBody}.`, 'secret'), null);

    assert.equal(verifyJwt(signJwt({ sub: 1 }, 'secret', -10), 'secret'), null);
  });
});

describe('авторизация и доступ', () => {
  it('без токена — 401, USER на /admin — 403', async () => {
    const user = await createUser('USER');
    const token = await tokenFor(user.login);
    assert.equal((await api('GET', '/api/admin/users')).status, 401);
    assert.equal((await api('GET', '/api/admin/users', { token })).status, 403);
    assert.equal((await api('GET', '/api/admin/dashboard', { token })).status, 403);
  });

  it('неверный пароль — 401, в ответах нет хеша пароля', async () => {
    const user = await createUser('USER');
    const bad = await api('POST', '/api/auth/login', { body: { login: user.login, password: 'wrong-password' } });
    assert.equal(bad.status, 401);

    const { adminToken } = await setup();
    const list = await api('GET', '/api/admin/users', { token: adminToken });
    assert.equal(list.status, 200);
    assert.ok(!JSON.stringify(list.body).includes('passwordHash'));
    assert.ok(!JSON.stringify(list.body).includes('scrypt$'));
  });

  it('refresh-cookie: httpOnly, обновляет сессию; без cookie — 401', async () => {
    const user = await createUser('USER');
    const login = await fetch(url('/api/auth/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login: user.login, password: 'password123' }),
    });
    const cookie = login.headers.get('set-cookie') ?? '';
    assert.match(cookie, /refresh_token=/);
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /SameSite=Strict/i);

    const refreshed = await fetch(url('/api/auth/refresh'), { method: 'POST', headers: { Cookie: cookie.split(';')[0] } });
    assert.equal(refreshed.status, 200);
    assert.ok((await refreshed.json()).accessToken);
    assert.equal((await api('POST', '/api/auth/refresh')).status, 401);
  });

  it('заблокированный и удалённый пользователь со старым токеном получает 401', async () => {
    const { adminToken } = await setup();
    const user = await createUser('USER');
    const token = await tokenFor(user.login);
    assert.equal((await api('GET', '/api/me', { token })).status, 200);

    await api('PATCH', `/api/admin/users/${user.id}`, { token: adminToken, body: { isActive: false } });
    assert.equal((await api('GET', '/api/me', { token })).status, 401);

    const other = await createUser('USER');
    const otherToken = await tokenFor(other.login);
    assert.equal((await api('DELETE', `/api/admin/users/${other.id}`, { token: adminToken })).status, 204);
    assert.equal((await api('GET', '/api/me', { token: otherToken })).status, 401);
  });

  it('временный пароль: до смены доступен только /me', async () => {
    const { adminToken } = await setup();
    const created = await api('POST', '/api/admin/users', {
      token: adminToken,
      body: { fullName: 'Петров Пётр', login: 'petrov', password: 'temp-pass-1', role: 'USER' },
    });
    assert.equal(created.status, 201);

    const login = await api('POST', '/api/auth/login', { body: { login: 'petrov', password: 'temp-pass-1' } });
    assert.equal(login.body.user.mustChangePassword, true);
    const token = login.body.accessToken;
    assert.equal((await api('GET', '/api/me/credentials', { token })).status, 403);

    const changed = await api('POST', '/api/auth/change-password', {
      token,
      body: { currentPassword: 'temp-pass-1', newPassword: 'new-pass-123' },
    });
    assert.equal(changed.status, 200);
    // Старый токен отозван, новый работает
    assert.equal((await api('GET', '/api/me', { token })).status, 401);
    assert.equal((await api('GET', '/api/me/credentials', { token: changed.body.accessToken })).status, 200);
  });

  it('админ не может удалить себя и разжаловать последнего админа', async () => {
    const { admin, adminToken } = await setup();
    assert.equal((await api('DELETE', `/api/admin/users/${admin.id}`, { token: adminToken })).status, 400);
    assert.equal((await api('PATCH', `/api/admin/users/${admin.id}`, { token: adminToken, body: { role: 'USER' } })).status, 400);
  });

  it('ошибки валидации возвращаются по полям', async () => {
    const { adminToken } = await setup();
    const res = await api('POST', '/api/admin/users', {
      token: adminToken,
      body: { fullName: '', login: 'я', password: '1', role: 'ROOT' },
    });
    assert.equal(res.status, 400);
    assert.deepEqual(Object.keys(res.body.details).sort(), ['fullName', 'login', 'password', 'role']);
  });
});

describe('пользователи и справочник', () => {
  it('создание USER создаёт записи по справочнику, ADMIN — не создаёт', async () => {
    const { adminToken } = await setup();
    await createCatalogItem(adminToken, 'А');
    await createCatalogItem(adminToken, 'Б');

    const user = await api('POST', '/api/admin/users', {
      token: adminToken,
      body: { fullName: 'Иванов', login: 'ivanov', password: 'password123', role: 'USER' },
    });
    const admin2 = await api('POST', '/api/admin/users', {
      token: adminToken,
      body: { fullName: 'Сидоров', login: 'sidorov', password: 'password123', role: 'ADMIN' },
    });

    assert.equal(await prisma.userCredential.count({ where: { userId: user.body.id } }), 2);
    assert.equal(await prisma.userCredential.count({ where: { userId: admin2.body.id } }), 0);
  });

  it('новая позиция справочника появляется у всех сотрудников (backfill)', async () => {
    const { adminToken } = await setup();
    const u1 = await createUser('USER');
    const u2 = await createUser('USER');
    const item = await createCatalogItem(adminToken);
    const rows = await prisma.userCredential.findMany({ where: { credentialId: item.id } });
    assert.deepEqual(rows.map((r) => r.userId).sort(), [u1.id, u2.id].sort());
  });

  it('логин уникален', async () => {
    const { admin, adminToken } = await setup();
    const res = await api('POST', '/api/admin/users', {
      token: adminToken,
      body: { fullName: 'Дубль', login: admin.login, password: 'password123', role: 'USER' },
    });
    assert.equal(res.status, 409);
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
    const res = await api('PATCH', `/api/me/credentials/${uc.id}`, { token, body: { issueDate } });
    assert.equal(res.status, 200);
    assert.equal(res.body.issueDate, issueDate);
    assert.equal(res.body.expiryDate, addMonths(issueDate, 12));
    assert.equal(res.body.status, 'RED'); // давно истекло
  });

  it('дата выдачи в будущем запрещена', async () => {
    const { token, uc } = await userWithCredential();
    const res = await api('PATCH', `/api/me/credentials/${uc.id}`, { token, body: { issueDate: addDays(today(), 1) } });
    assert.equal(res.status, 400);
    assert.ok(res.body.details.issueDate);
  });

  it('сотрудник не может изменить номер, комментарий или дату окончания', async () => {
    const { token, uc } = await userWithCredential();
    const res = await api('PATCH', `/api/me/credentials/${uc.id}`, {
      token,
      body: { issueDate: today(), number: 'X-1', comment: 'взлом', expiryDate: '2099-01-01' },
    });
    assert.equal(res.status, 200);
    const row = await prisma.userCredential.findUniqueOrThrow({ where: { id: uc.id } });
    assert.equal(row.number, null);
    assert.equal(row.comment, null);
    assert.equal(row.expiryDate?.toISOString().slice(0, 10), addMonths(today(), 12));
  });

  it('IDOR: чужое удостоверение — 404', async () => {
    const { uc } = await userWithCredential();
    const stranger = await createUser('USER');
    const strangerToken = await tokenFor(stranger.login);
    const res = await api('PATCH', `/api/me/credentials/${uc.id}`, { token: strangerToken, body: { issueDate: today() } });
    assert.equal(res.status, 404);
  });

  it('изменение даты пишет журнал с «было/стало»', async () => {
    const { token, uc, user } = await userWithCredential(12);
    await api('PATCH', `/api/me/credentials/${uc.id}`, { token, body: { issueDate: today() } });
    const log = await prisma.auditLog.findFirstOrThrow({ where: { action: 'credential.update', targetUserId: user.id } });
    const diff = log.diff as Record<string, unknown>;
    assert.deepEqual(diff.issueDate, { from: null, to: today() });
    assert.deepEqual(diff.expiryDate, { from: null, to: addMonths(today(), 12) });
  });

  it('пометка на удаление скрывает запись из списков и статистики, снятие — возвращает', async () => {
    const { adminToken, token, uc } = await userWithCredential();
    const before = await api('GET', '/api/admin/dashboard', { token: adminToken });
    assert.equal(before.body.counts.WHITE, 1);

    assert.equal((await api('POST', `/api/admin/credentials/${uc.id}/mark-deletion`, { token: adminToken })).status, 200);
    const afterMark = await api('GET', '/api/admin/dashboard', { token: adminToken });
    assert.equal(afterMark.body.counts.WHITE, 0);
    assert.equal((await api('GET', '/api/me/credentials', { token })).body.length, 0);
    const marked = await api('GET', '/api/admin/credentials?marked=true', { token: adminToken });
    assert.equal(marked.body.total, 1);

    await api('POST', `/api/admin/credentials/${uc.id}/unmark-deletion`, { token: adminToken });
    assert.equal((await api('GET', '/api/me/credentials', { token })).body.length, 1);
  });

  it('фильтр по статусу у админа', async () => {
    const { adminToken, token, uc } = await userWithCredential(12);
    // Выдано 11 месяцев назад → осталось около месяца → жёлтый
    await api('PATCH', `/api/me/credentials/${uc.id}`, { token, body: { issueDate: addMonths(today(), -11) } });
    const yellow = await api('GET', '/api/admin/credentials?status=YELLOW', { token: adminToken });
    const green = await api('GET', '/api/admin/credentials?status=GREEN', { token: adminToken });
    assert.equal(yellow.body.total, 1);
    assert.equal(green.body.total, 0);
  });

  it('очистка данных оставляет запись пустой', async () => {
    const { adminToken, token, uc } = await userWithCredential();
    await api('PATCH', `/api/me/credentials/${uc.id}`, { token, body: { issueDate: today() } });
    const res = await api('POST', `/api/admin/credentials/${uc.id}/clear`, { token: adminToken });
    assert.equal(res.body.issueDate, null);
    assert.equal(res.body.expiryDate, null);
    assert.equal(res.body.status, 'WHITE');
  });
});

describe('сообщения и уведомления', () => {
  it('broadcast получают только активные сотрудники', async () => {
    const { adminToken } = await setup();
    const active = await createUser('USER');
    const blocked = await createUser('USER', { isActive: false });
    const res = await api('POST', '/api/admin/messages', {
      token: adminToken,
      body: { recipient: 'all', subject: 'Собрание', body: 'В пятницу в 10:00' },
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.recipientsCount, 1);
    assert.equal(await prisma.notification.count({ where: { userId: active.id, kind: 'MESSAGE' } }), 1);
    assert.equal(await prisma.notification.count({ where: { userId: blocked.id } }), 0);

    const token = await tokenFor(active.login);
    assert.equal((await api('GET', '/api/me/notifications/unread-count', { token })).body.count, 1);
    await api('POST', '/api/me/notifications/read-all', { token });
    assert.equal((await api('GET', '/api/me/notifications/unread-count', { token })).body.count, 0);
  });

  it('проверка сроков не плодит дубли, админы получают копии красных и жёлтых', async () => {
    const { adminToken, admin } = await setup();
    const admin2 = await createUser('ADMIN');
    await createCatalogItem(adminToken, 'Медосмотр', 12);
    const user = await createUser('USER');
    const [item] = await prisma.credential.findMany();
    // Истекает через 5 дней
    const expiry = addDays(today(), 5);
    await prisma.userCredential.create({
      data: {
        userId: user.id,
        credentialId: item.id,
        issueDate: new Date(`${addMonths(expiry, -12)}T00:00:00Z`),
        expiryDate: new Date(`${expiry}T00:00:00Z`),
      },
    });

    assert.equal(await checkExpiryNotifications(), 1);
    assert.equal(await checkExpiryNotifications(), 0);
    assert.equal(await prisma.notification.count({ where: { userId: user.id, kind: 'EXPIRY' } }), 1);
    const n = await prisma.notification.findFirstOrThrow({ where: { userId: user.id } });
    assert.equal(n.level, 'RED');

    for (const a of [admin, admin2]) {
      const copies = await prisma.notification.findMany({ where: { userId: a.id, kind: 'EXPIRY' } });
      assert.equal(copies.length, 1);
      assert.equal(copies[0].level, 'RED');
      assert.ok(copies[0].title.startsWith(user.fullName));
      assert.equal(copies[0].link, `/admin/users/${user.id}`);
    }
  });
});
