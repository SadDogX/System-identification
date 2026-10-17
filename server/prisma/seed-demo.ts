/**
 * Демо-данные для знакомства с системой: сотрудники с разными сроками,
 * сообщения, уведомления, записи журнала.
 * Запуск: npm run db:demo (после npm run db:seed). Все действия идут через
 * серверные сервисы — так же, как их выполняли бы админ и сотрудники в интерфейсе.
 */
import { addDays, addMonths, todayInTimezone } from '@app/shared';
import { prisma } from '../src/db.ts';
import * as users from '../src/services/users.service.ts';
import * as catalog from '../src/services/catalog.service.ts';
import * as credentials from '../src/services/credentials.service.ts';
import * as messages from '../src/services/messages.service.ts';
import { checkExpiryNotifications } from '../src/services/notifications.service.ts';

/** Пароль всех демо-пользователей. */
export const DEMO_PASSWORD = 'demo12345';

const HEIGHT_WORK = 'Допуск к работам на высоте';

// Сколько дней осталось до окончания по каждому удостоверению (null — не заполнено).
// Порядок: охрана труда, электробезопасность, пожарная безопасность, медзаключение, работы на высоте.
const EMPLOYEES: {
  fullName: string;
  login: string;
  position: string;
  daysLeft: (number | null)[];
  blocked?: boolean;
  mustChangePassword?: boolean;
}[] = [
  { fullName: 'Иванов Иван Иванович', login: 'ivanov', position: 'Электромонтёр', daysLeft: [400, 5, 700, 60, 200] },
  { fullName: 'Петров Пётр Сергеевич', login: 'petrov', position: 'Мастер участка', daysLeft: [-12, 150, null, 8, 30] },
  { fullName: 'Сидорова Анна Викторовна', login: 'sidorova', position: 'Инженер по охране труда', daysLeft: [900, 300, 1000, 250, null] },
  { fullName: 'Кузнецов Алексей Павлович', login: 'kuznetsov', position: 'Слесарь-ремонтник', daysLeft: [null, -3, 45, null, null] },
  { fullName: 'Смирнов Дмитрий Олегович', login: 'smirnov', position: 'Сварщик', daysLeft: [80, 20, 500, 2, 120] },
  { fullName: 'Васильева Елена Андреевна', login: 'vasilieva', position: 'Кладовщик', daysLeft: [600, null, 365, 180, null] },
  { fullName: 'Новиков Сергей Николаевич', login: 'novikov', position: 'Водитель погрузчика', daysLeft: [0, 95, 89, 11, 10] },
  { fullName: 'Морозова Ольга Игоревна', login: 'morozova', position: 'Лаборант', daysLeft: [null, null, null, null, null], mustChangePassword: true },
  { fullName: 'Фёдоров Артём Ильич', login: 'fedorov', position: 'Электрогазосварщик', daysLeft: [300, 40, 800, 70, 15], blocked: true },
];

const NUMBER_PREFIX = ['ОТ', 'ЭБ', 'ПБ', 'МЗ', 'ВР'];

/** Должность из справочника (создаётся, если её ещё нет). */
async function positionId(name: string): Promise<number> {
  const row = await prisma.position.upsert({ where: { name }, update: {}, create: { name } });
  return row.id;
}

async function main() {
  if (await prisma.user.findUnique({ where: { login: 'ivanov' } })) {
    console.log('Демо-данные уже загружены. Чтобы пересоздать: npm run db:reset && npm run db:demo');
    return;
  }
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN', isDeleted: false }, orderBy: { id: 'asc' } });
  if (!admin) throw new Error('Нет администратора — сначала выполните npm run db:seed');

  const settingsTz = 'Europe/Moscow';
  const today = todayInTimezone(settingsTz);

  // Справочник: позиции из основного seed + одна новая (покажет автодобавление всем сотрудникам)
  const baseItems = await prisma.credential.findMany({ where: { isArchived: false }, orderBy: { sortOrder: 'asc' } });
  if (baseItems.length < 4) throw new Error('В справочнике меньше 4 позиций — выполните npm run db:seed');

  // Второй администратор — можно войти сразу, без смены пароля
  const admin2 = await users.create(admin, {
    fullName: 'Ковалёва Мария Петровна',
    login: 'kovaleva',
    password: DEMO_PASSWORD,
    role: 'ADMIN',
    positionId: await positionId('Специалист по кадрам'),
    email: 'kovaleva@example.com',
  });
  await prisma.user.update({ where: { id: admin2.id }, data: { mustChangePassword: false } });
  const actor = await prisma.user.findUniqueOrThrow({ where: { id: admin2.id } });

  // Сотрудники
  const created: { id: number; spec: (typeof EMPLOYEES)[number] }[] = [];
  for (const spec of EMPLOYEES) {
    const u = await users.create(actor, {
      fullName: spec.fullName,
      login: spec.login,
      password: DEMO_PASSWORD,
      role: 'USER',
      positionId: await positionId(spec.position),
      phone: `+7 (900) 000-${String(10 + created.length).padStart(2, '0')}-${String(20 + created.length * 3).padStart(2, '0')}`,
    });
    if (!spec.mustChangePassword) {
      await prisma.user.update({ where: { id: u.id }, data: { mustChangePassword: false } });
    }
    created.push({ id: u.id, spec });
  }

  // Новая позиция справочника появляется у всех уже созданных сотрудников
  const height = await catalog.create(actor, { name: HEIGHT_WORK, validityMonths: 12, sortOrder: 5 });
  const items = [...baseItems.slice(0, 4), { id: height.id, validityMonths: height.validityMonths }];

  // Сотрудники вносят даты выдачи, админ добавляет номера
  let counter = 100;
  for (const { id, spec } of created) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id } });
    const rows = await prisma.userCredential.findMany({ where: { userId: id } });
    for (const [i, item] of items.entries()) {
      const target = spec.daysLeft[i];
      if (target === null) continue;
      const row = rows.find((r) => r.credentialId === item.id)!;
      // Дата выдачи, при которой до окончания останется target дней
      const issueDate = addMonths(addDays(today, target), -item.validityMonths);
      await credentials.updateOwn(user, row.id, issueDate);
      counter += 7;
      await credentials.adminUpdate(actor, row.id, { number: `${NUMBER_PREFIX[i]}-2026-${String(counter).padStart(4, '0')}` });
    }
  }

  const byLogin = (login: string) => created.find((c) => c.spec.login === login)!.id;

  // Кладовщику работы на высоте не нужны — пометка на удаление
  const vasilievaHeight = await prisma.userCredential.findFirstOrThrow({
    where: { userId: byLogin('vasilieva'), credentialId: height.id },
  });
  await credentials.adminMark(actor, vasilievaHeight.id);

  // Комментарий к просроченному удостоверению
  const petrovOt = await prisma.userCredential.findFirstOrThrow({
    where: { userId: byLogin('petrov'), credentialId: items[0].id },
  });
  await credentials.adminUpdate(actor, petrovOt.id, { comment: 'Записан на обучение, ждём новое удостоверение' });

  // Блокировка уволившегося сотрудника
  for (const { id, spec } of created) {
    if (spec.blocked) await users.update(actor, id, { isActive: false });
  }

  // Сообщения
  await messages.send(actor, {
    recipient: 'all',
    subject: 'Плановое обучение по охране труда',
    body: 'Уважаемые коллеги! Обучение по охране труда пройдёт в конференц-зале. Проверьте сроки своих удостоверений и обновите данные в системе.',
  });
  await messages.send(actor, {
    recipient: 'user',
    userId: byLogin('petrov'),
    subject: 'Просрочено удостоверение по охране труда',
    body: 'Пётр Сергеевич, срок вашего удостоверения по охране труда истёк. Пожалуйста, внесите новую дату выдачи после обучения.',
  });
  await messages.send(actor, {
    recipient: 'user',
    userId: byLogin('morozova'),
    subject: 'Добро пожаловать',
    body: 'Ольга Игоревна, заполните, пожалуйста, даты выдачи ваших удостоверений в разделе «Мои удостоверения».',
  });

  // Уведомления о сроках сотрудникам и копии администраторам
  await checkExpiryNotifications();

  // Сидорова уже всё прочитала
  await prisma.notification.updateMany({ where: { userId: byLogin('sidorova') }, data: { readAt: new Date() } });

  console.log(`Демо-данные загружены: ${created.length} сотрудников, 1 администратор, пароль у всех — ${DEMO_PASSWORD}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
