/**
 * Демо-данные для знакомства с системой: сотрудники с разными сроками,
 * сообщения, уведомления, записи журнала.
 * Запуск: npm run db:demo (после npm run db:seed). Все действия идут через
 * серверные сервисы — так же, как их выполняли бы админ и сотрудники в интерфейсе.
 */
import { addDays, addMonths, todayInTimezone } from '@app/shared';
import { prisma } from '../src/core/db.ts';
import * as users from '../src/modules/users/users.service.ts';
import { assignEmployee, setAccountRoles } from '../src/modules/organization/organization.service.ts';
import * as catalog from '../src/modules/catalog/catalog.service.ts';
import * as credentials from '../src/modules/credentials/credentials.service.ts';
import * as messages from '../src/modules/messages/messages.service.ts';
import { checkExpiryNotifications } from '../src/modules/notifications/notifications.service.ts';

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
  orgRole?: 'MANAGER' | 'COORDINATOR' | 'SENIOR_MECHANIC' | 'MECHANIC' | 'SHOP_FOREMAN' | 'SHOP_EMPLOYEE' | 'EMPLOYEE';
  track?: 'TRS' | 'R_AND_M';
  baseCode?: 'NZV_BPO' | 'ASTR_BPO';
  supervisorLogin?: string;
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
  { fullName: 'Андреев Максим Игоревич', login: 'demo_manager_nzv', position: 'Менеджер БПО', daysLeft: [null, null, null, null, null], orgRole: 'MANAGER', track: 'TRS', baseCode: 'NZV_BPO' },
  { fullName: 'Беляев Роман Сергеевич', login: 'demo_manager_astr', position: 'Менеджер БПО', daysLeft: [null, null, null, null, null], orgRole: 'MANAGER', track: 'TRS', baseCode: 'ASTR_BPO' },
  { fullName: 'Воробьёв Кирилл Андреевич', login: 'demo_coord_nzv_1', position: 'Координатор', daysLeft: [null, null, null, null, null], orgRole: 'COORDINATOR', track: 'TRS', baseCode: 'NZV_BPO', supervisorLogin: 'demo_manager_nzv' },
  { fullName: 'Гаврилов Денис Павлович', login: 'demo_coord_nzv_2', position: 'Координатор', daysLeft: [null, null, null, null, null], orgRole: 'COORDINATOR', track: 'TRS', baseCode: 'NZV_BPO', supervisorLogin: 'demo_manager_nzv' },
  { fullName: 'Данилов Артём Олегович', login: 'demo_coord_astr_1', position: 'Координатор', daysLeft: [null, null, null, null, null], orgRole: 'COORDINATOR', track: 'TRS', baseCode: 'ASTR_BPO', supervisorLogin: 'demo_manager_astr' },
  { fullName: 'Егоров Илья Максимович', login: 'demo_coord_astr_2', position: 'Координатор', daysLeft: [null, null, null, null, null], orgRole: 'COORDINATOR', track: 'TRS', baseCode: 'ASTR_BPO', supervisorLogin: 'demo_manager_astr' },
  { fullName: 'Жуков Павел Дмитриевич', login: 'demo_trs_nzv_1', position: 'Техник по бурению 1 категории', daysLeft: [null, null, null, null, null], orgRole: 'EMPLOYEE', track: 'TRS', baseCode: 'NZV_BPO', supervisorLogin: 'demo_coord_nzv_1' },
  { fullName: 'Зайцев Никита Алексеевич', login: 'demo_trs_nzv_2', position: 'Техник по бурению 2 категории', daysLeft: [null, null, null, null, null], orgRole: 'EMPLOYEE', track: 'TRS', baseCode: 'NZV_BPO', supervisorLogin: 'demo_coord_nzv_1' },
  { fullName: 'Ильин Михаил Романович', login: 'demo_trs_nzv_3', position: 'Инженер по бурению', daysLeft: [null, null, null, null, null], orgRole: 'EMPLOYEE', track: 'TRS', baseCode: 'NZV_BPO', supervisorLogin: 'demo_coord_nzv_2' },
  { fullName: 'Козлов Егор Владимирович', login: 'demo_trs_nzv_4', position: 'Инженер по бурению 2 категории', daysLeft: [null, null, null, null, null], orgRole: 'EMPLOYEE', track: 'TRS', baseCode: 'NZV_BPO', supervisorLogin: 'demo_coord_nzv_2' },
  { fullName: 'Лебедев Арсений Евгеньевич', login: 'demo_trs_astr_1', position: 'Техник по бурению 1 категории', daysLeft: [null, null, null, null, null], orgRole: 'EMPLOYEE', track: 'TRS', baseCode: 'ASTR_BPO', supervisorLogin: 'demo_coord_astr_1' },
  { fullName: 'Макаров Тимофей Ильич', login: 'demo_trs_astr_2', position: 'Инженер по бурению', daysLeft: [null, null, null, null, null], orgRole: 'EMPLOYEE', track: 'TRS', baseCode: 'ASTR_BPO', supervisorLogin: 'demo_coord_astr_1' },
  { fullName: 'Николаев Владислав Денисович', login: 'demo_trs_astr_3', position: 'Техник по бурению 3 категории', daysLeft: [null, null, null, null, null], orgRole: 'EMPLOYEE', track: 'TRS', baseCode: 'ASTR_BPO', supervisorLogin: 'demo_coord_astr_2' },
  { fullName: 'Орлов Матвей Константинович', login: 'demo_trs_astr_4', position: 'Инженер по бурению 1 категории', daysLeft: [null, null, null, null, null], orgRole: 'EMPLOYEE', track: 'TRS', baseCode: 'ASTR_BPO', supervisorLogin: 'demo_coord_astr_2' },
  { fullName: 'Павлов Андрей Аркадьевич', login: 'demo_senior_mech', position: 'Старший механик', daysLeft: [null, null, null, null, null], orgRole: 'SENIOR_MECHANIC', track: 'R_AND_M' },
  { fullName: 'Романов Сергей Викторович', login: 'demo_mechanic_nzv', position: 'Механик', daysLeft: [null, null, null, null, null], orgRole: 'MECHANIC', track: 'R_AND_M', baseCode: 'NZV_BPO', supervisorLogin: 'demo_senior_mech' },
  { fullName: 'Семёнов Алексей Борисович', login: 'demo_mechanic_astr', position: 'Механик', daysLeft: [null, null, null, null, null], orgRole: 'MECHANIC', track: 'R_AND_M', baseCode: 'ASTR_BPO', supervisorLogin: 'demo_senior_mech' },
  { fullName: 'Тихонов Евгений Олегович', login: 'demo_foreman_nzv_1', position: 'Мастер цеха', daysLeft: [null, null, null, null, null], orgRole: 'SHOP_FOREMAN', track: 'R_AND_M', baseCode: 'NZV_BPO', supervisorLogin: 'demo_mechanic_nzv' },
  { fullName: 'Ушаков Дмитрий Алексеевич', login: 'demo_foreman_nzv_2', position: 'Мастер цеха', daysLeft: [null, null, null, null, null], orgRole: 'SHOP_FOREMAN', track: 'R_AND_M', baseCode: 'NZV_BPO', supervisorLogin: 'demo_mechanic_nzv' },
  { fullName: 'Фомин Артём Валерьевич', login: 'demo_foreman_astr_1', position: 'Мастер цеха', daysLeft: [null, null, null, null, null], orgRole: 'SHOP_FOREMAN', track: 'R_AND_M', baseCode: 'ASTR_BPO', supervisorLogin: 'demo_mechanic_astr' },
  { fullName: 'Харитонов Игорь Петрович', login: 'demo_foreman_astr_2', position: 'Мастер цеха', daysLeft: [null, null, null, null, null], orgRole: 'SHOP_FOREMAN', track: 'R_AND_M', baseCode: 'ASTR_BPO', supervisorLogin: 'demo_mechanic_astr' },
  { fullName: 'Цветков Иван Сергеевич', login: 'demo_shop_nzv_1', position: 'Слесарь', daysLeft: [null, null, null, null, null], orgRole: 'SHOP_EMPLOYEE', track: 'R_AND_M', baseCode: 'NZV_BPO', supervisorLogin: 'demo_foreman_nzv_1' },
  { fullName: 'Чернов Максим Андреевич', login: 'demo_shop_nzv_2', position: 'Слесарь', daysLeft: [null, null, null, null, null], orgRole: 'SHOP_EMPLOYEE', track: 'R_AND_M', baseCode: 'NZV_BPO', supervisorLogin: 'demo_foreman_nzv_1' },
  { fullName: 'Шестаков Павел Ильич', login: 'demo_shop_nzv_3', position: 'Слесарь', daysLeft: [null, null, null, null, null], orgRole: 'SHOP_EMPLOYEE', track: 'R_AND_M', baseCode: 'NZV_BPO', supervisorLogin: 'demo_foreman_nzv_2' },
  { fullName: 'Щербаков Никита Романович', login: 'demo_shop_nzv_4', position: 'Слесарь', daysLeft: [null, null, null, null, null], orgRole: 'SHOP_EMPLOYEE', track: 'R_AND_M', baseCode: 'NZV_BPO', supervisorLogin: 'demo_foreman_nzv_2' },
  { fullName: 'Юдин Михаил Евгеньевич', login: 'demo_shop_astr_1', position: 'Слесарь', daysLeft: [null, null, null, null, null], orgRole: 'SHOP_EMPLOYEE', track: 'R_AND_M', baseCode: 'ASTR_BPO', supervisorLogin: 'demo_foreman_astr_1' },
  { fullName: 'Яковлев Кирилл Владимирович', login: 'demo_shop_astr_2', position: 'Слесарь', daysLeft: [null, null, null, null, null], orgRole: 'SHOP_EMPLOYEE', track: 'R_AND_M', baseCode: 'ASTR_BPO', supervisorLogin: 'demo_foreman_astr_1' },
  { fullName: 'Абрамов Роман Денисович', login: 'demo_shop_astr_3', position: 'Слесарь', daysLeft: [null, null, null, null, null], orgRole: 'SHOP_EMPLOYEE', track: 'R_AND_M', baseCode: 'ASTR_BPO', supervisorLogin: 'demo_foreman_astr_2' },
  { fullName: 'Борисов Арсений Павлович', login: 'demo_shop_astr_4', position: 'Слесарь', daysLeft: [null, null, null, null, null], orgRole: 'SHOP_EMPLOYEE', track: 'R_AND_M', baseCode: 'ASTR_BPO', supervisorLogin: 'demo_foreman_astr_2' },
  { fullName: 'Власов Тимур Олегович', login: 'demo_shop_nzv_5', position: 'Слесарь', daysLeft: [null, null, null, null, null], orgRole: 'SHOP_EMPLOYEE', track: 'R_AND_M', baseCode: 'NZV_BPO', supervisorLogin: 'demo_foreman_nzv_1' },
  { fullName: 'Голубев Аркадий Максимович', login: 'demo_shop_astr_5', position: 'Слесарь', daysLeft: [null, null, null, null, null], orgRole: 'SHOP_EMPLOYEE', track: 'R_AND_M', baseCode: 'ASTR_BPO', supervisorLogin: 'demo_foreman_astr_1' },
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

  // Полная синтетическая оргструктура: TRS и R&M для обеих демо-баз.
  const createdByLogin = new Map(created.map(({ id, spec }) => [spec.login, id]));
  const baseByCode = new Map(
    (await prisma.base.findMany({ where: { code: { in: ['NZV_BPO', 'ASTR_BPO'] } } })).map((base) => [base.code!, base.id]),
  );
  for (const { id, spec } of created) {
    if (!spec.orgRole || !spec.track) continue;
    await setAccountRoles(actor, id, { roles: [spec.orgRole] });
    const employee = await prisma.employee.findUniqueOrThrow({ where: { userId: id } });
    const supervisorUserId = spec.supervisorLogin ? createdByLogin.get(spec.supervisorLogin) : undefined;
    const supervisor = supervisorUserId
      ? await prisma.employee.findUniqueOrThrow({ where: { userId: supervisorUserId } })
      : undefined;
    const baseId = spec.baseCode ? baseByCode.get(spec.baseCode) : undefined;
    if (spec.baseCode && !baseId) throw new Error(`Не найдена база ${spec.baseCode}; сначала выполните npm run db:seed`);
    await assignEmployee(actor, employee.id, {
      track: spec.track,
      ...(baseId ? { baseId } : {}),
      ...(supervisor ? { supervisorEmployeeId: supervisor.id } : {}),
      positionId: await positionId(spec.position),
      startsAt: today,
      reason: 'Синтетическое демо-назначение',
    });
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
