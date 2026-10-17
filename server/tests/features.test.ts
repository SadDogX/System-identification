import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { addMonths, todayInTimezone } from '@app/shared';
import { prisma } from '../src/db.ts';
import { api, createUser, resetDb, startServer, stopServer, tokenFor, url } from './helpers.ts';

const today = () => todayInTimezone('Europe/Moscow');
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');

before(startServer);
after(stopServer);
beforeEach(resetDb);

async function setup() {
  const admin = await createUser('ADMIN');
  return { admin, adminToken: await tokenFor(admin.login) };
}

async function userWithItem() {
  const { adminToken } = await setup();
  const item = await prisma.credential.create({ data: { name: 'Охрана труда', validityMonths: 12 } });
  const user = await createUser('USER');
  const uc = await prisma.userCredential.create({ data: { userId: user.id, credentialId: item.id } });
  return { adminToken, user, token: await tokenFor(user.login), uc };
}

const upload = (id: number, token: string, body: Buffer) =>
  fetch(url(`/api/credentials/${id}/photo`), {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'image/png' },
    body: new Uint8Array(body),
  });

const download = (id: number, token: string) =>
  fetch(url(`/api/credentials/${id}/photo`), { headers: { Authorization: `Bearer ${token}` } });

describe('сообщения и уведомления администраторов', () => {
  it('сообщение видят остальные админы, статистика прочтений не искажается', async () => {
    const { adminToken } = await setup();
    const admin2 = await createUser('ADMIN');
    const user = await createUser('USER');
    const res = await api('POST', '/api/admin/messages', {
      token: adminToken,
      body: { recipient: 'user', userId: user.id, subject: 'Тема', body: 'Текст' },
    });
    assert.equal(res.status, 201);
    const copy = await prisma.notification.findFirstOrThrow({ where: { userId: admin2.id, kind: 'MESSAGE' } });
    assert.match(copy.title, /Тема/);
    const history = await api('GET', '/api/admin/messages', { token: adminToken });
    assert.equal(history.body.items[0].recipientsCount, 1);
  });

  it('прочитанные убираются из списка, непрочитанные остаются, статистика сохраняется', async () => {
    const { adminToken } = await setup();
    const user = await createUser('USER');
    for (const subject of ['Первое', 'Второе']) {
      await api('POST', '/api/admin/messages', { token: adminToken, body: { recipient: 'user', userId: user.id, subject, body: 'Текст' } });
    }
    const token = await tokenFor(user.login);
    const list = await api('GET', '/api/me/notifications', { token });
    await api('PATCH', `/api/me/notifications/${list.body.items[0].id}/read`, { token });

    const dismissed = await api('POST', '/api/me/notifications/dismiss-read', { token });
    assert.equal(dismissed.body.dismissed, 1);
    const afterDismiss = await api('GET', '/api/me/notifications', { token });
    assert.equal(afterDismiss.body.total, 1);
    assert.equal((await api('GET', '/api/me/notifications/unread-count', { token })).body.count, 1);

    const history = await api('GET', '/api/admin/messages', { token: adminToken });
    const readTotal = history.body.items.reduce((sum: number, m: { readCount: number }) => sum + m.readCount, 0);
    assert.equal(readTotal, 1);
  });
});

describe('фото удостоверения', () => {
  it('загрузка своего, тип по содержимому, чужое недоступно, админ видит', async () => {
    const { adminToken, token, uc } = await userWithItem();
    assert.equal((await upload(uc.id, token, Buffer.from('not an image'))).status, 400);
    const ok = await upload(uc.id, token, PNG);
    assert.equal(ok.status, 200);
    assert.equal((await ok.json()).photoMime, 'image/png');

    const own = await download(uc.id, token);
    assert.equal(own.status, 200);
    assert.equal(own.headers.get('content-type'), 'image/png');
    assert.deepEqual(Buffer.from(await own.arrayBuffer()), PNG);

    const stranger = await createUser('USER');
    const strangerToken = await tokenFor(stranger.login);
    assert.equal((await download(uc.id, strangerToken)).status, 404);
    assert.equal((await upload(uc.id, strangerToken, PNG)).status, 404);
    assert.equal((await download(uc.id, adminToken)).status, 200);

    const removed = await fetch(url(`/api/credentials/${uc.id}/photo`), { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    assert.equal(removed.status, 204);
    assert.equal((await download(uc.id, token)).status, 404);
  });

  it('файл больше 5 МБ отклоняется', async () => {
    const { token, uc } = await userWithItem();
    const big = Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024)]);
    assert.equal((await upload(uc.id, token, big)).status, 413);
  });

  it('сотрудник очищает своё удостоверение: даты, номер и фото', async () => {
    const { token, uc } = await userWithItem();
    await api('PATCH', `/api/me/credentials/${uc.id}`, { token, body: { issueDate: today() } });
    await upload(uc.id, token, PNG);
    const res = await api('POST', `/api/me/credentials/${uc.id}/clear`, { token });
    assert.equal(res.status, 200);
    assert.equal(res.body.issueDate, null);
    assert.equal(res.body.photoMime, null);
    assert.equal(res.body.status, 'WHITE');
    assert.equal((await download(uc.id, token)).status, 404);
  });
});

describe('должности и сводная таблица', () => {
  it('справочник должностей, уникальность, назначение, журнал с названием', async () => {
    const { adminToken } = await setup();
    const pos = await api('POST', '/api/admin/positions', { token: adminToken, body: { name: 'Сварщик' } });
    assert.equal(pos.status, 201);
    assert.equal((await api('POST', '/api/admin/positions', { token: adminToken, body: { name: 'Сварщик' } })).status, 409);

    const user = await createUser('USER');
    const upd = await api('PATCH', `/api/admin/users/${user.id}`, { token: adminToken, body: { positionId: pos.body.id } });
    assert.equal(upd.body.position, 'Сварщик');
    const log = await prisma.auditLog.findFirstOrThrow({ where: { action: 'user.update', targetUserId: user.id } });
    assert.deepEqual((log.diff as Record<string, unknown>).position, { from: null, to: 'Сварщик' });

    assert.equal((await api('PATCH', `/api/admin/users/${user.id}`, { token: adminToken, body: { positionId: 99999 } })).status, 400);
    const list = await api('GET', '/api/admin/positions', { token: adminToken });
    assert.equal(list.body[0].usersCount, 1);
  });

  it('сводная таблица: сотрудник × удостоверение со статусом, только для админа', async () => {
    const { adminToken, user, token, uc } = await userWithItem();
    await api('PATCH', `/api/me/credentials/${uc.id}`, { token, body: { issueDate: today() } });
    const res = await api('GET', '/api/admin/overview', { token: adminToken });
    assert.equal(res.status, 200);
    assert.equal(res.body.credentials.length, 1);
    const row = res.body.rows.find((r: { user: { id: number } }) => r.user.id === user.id);
    assert.equal(row.cells[uc.credentialId].status, 'GREEN');
    assert.equal(row.cells[uc.credentialId].expiryDate, addMonths(today(), 12));
    assert.equal((await api('GET', '/api/admin/overview', { token })).status, 403);
  });
});
