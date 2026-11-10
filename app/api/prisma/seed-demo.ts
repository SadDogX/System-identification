/**
 * Демо-данные для знакомства с системой: сотрудники с разными сроками,
 * примеры интервального графика, сообщения, уведомления и записи журнала.
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
import { setScheduleRange } from '../src/modules/workSchedule/schedule.service.ts';

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

  { fullName: 'Ivanov Ivan Ivanovich', login: 'ivanov', position: 'Electrician', daysLeft: [400, 5, 700, 60, 200] },
  { fullName: 'Petrov Petr Sergeevich', login: 'petrov', position: 'Site Foreman', daysLeft: [-12, 150, null, 8, 30] },
  { fullName: 'Sidorova Anna Viktorovna', login: 'sidorova', position: 'Labor Safety Engineer', daysLeft: [900, 300, 1000, 250, null] },
  { fullName: 'Kuznetsov Alexey Pavlovich', login: 'kuznetsov', position: 'Repair Fitter', daysLeft: [null, -3, 45, null, null] },
  { fullName: 'Smirnov Dmitry Olegovich', login: 'smirnov', position: 'Welder', daysLeft: [80, 20, 500, 2, 120] },
  { fullName: 'Vasilieva Elena Andreevna', login: 'vasilieva', position: 'Storekeeper', daysLeft: [600, null, 365, 180, null] },
  { fullName: 'Novikov Sergey Nikolaevich', login: 'novikov', position: 'Forklift Driver', daysLeft: [0, 95, 89, 11, 10] },
  { fullName: 'Morozova Olga Igorevna', login: 'morozova', position: 'Laboratory Assistant', daysLeft: [null, null, null, null, null], mustChangePassword: true },
  { fullName: 'Fedorov Artem Ilyich', login: 'fedorov', position: 'Gas Electric Welder', daysLeft: [300, 40, 800, 70, 15], blocked: true },
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
  { fullName: 'Titon Alexey Sergeevich', login: 'demo_extra_01', position: 'Technician drilling', daysLeft: [null, null, null, null, null], orgRole: 'EMPLOYEE', track: 'TRS', baseCode: 'NZV_BPO', supervisorLogin: 'demo_coord_nzv_1' },
  { fullName: 'Fomina Elena Pavlovna', login: 'demo_extra_02', position: 'Drilling Engineer', daysLeft: [null, null, null, null, null], orgRole: 'EMPLOYEE', track: 'TRS', baseCode: 'NZV_BPO', supervisorLogin: 'demo_coord_nzv_2' },
  { fullName: 'Gromov Dmitry Andreevich', login: 'demo_extra_03', position: 'Technician drilling 2', daysLeft: [null, null, null, null, null], orgRole: 'EMPLOYEE', track: 'TRS', baseCode: 'ASTR_BPO', supervisorLogin: 'demo_coord_astr_1' },
  { fullName: 'Zaitseva Marina Igorevna', login: 'demo_extra_04', position: 'Drilling Engineer 1', daysLeft: [null, null, null, null, null], orgRole: 'EMPLOYEE', track: 'TRS', baseCode: 'ASTR_BPO', supervisorLogin: 'demo_coord_astr_2' },
  { fullName: 'Isaev Pavel Nikolaevich', login: 'demo_extra_05', position: 'Fitter extra NZV', daysLeft: [null, null, null, null, null], orgRole: 'SHOP_EMPLOYEE', track: 'R_AND_M', baseCode: 'NZV_BPO', supervisorLogin: 'demo_foreman_nzv_1' },
  { fullName: 'Klimova Olga Sergeevna', login: 'demo_extra_06', position: 'Fitter extra ASTR', daysLeft: [null, null, null, null, null], orgRole: 'SHOP_EMPLOYEE', track: 'R_AND_M', baseCode: 'ASTR_BPO', supervisorLogin: 'demo_foreman_astr_1' },
  { fullName: 'Lebedev Artem Olegovich', login: 'demo_extra_07', position: 'Shop Foreman extra', daysLeft: [null, null, null, null, null], orgRole: 'SHOP_FOREMAN', track: 'R_AND_M', baseCode: 'NZV_BPO', supervisorLogin: 'demo_mechanic_nzv' },
  { fullName: 'Morozova Anna Viktorovna', login: 'demo_extra_08', position: 'Mechanic extra', daysLeft: [null, null, null, null, null], orgRole: 'MECHANIC', track: 'R_AND_M', baseCode: 'ASTR_BPO', supervisorLogin: 'demo_senior_mech' },
  { fullName: 'Nikitin Sergey Petrovich', login: 'demo_extra_09', position: 'Labor Safety Engineer extra', daysLeft: [null, null, null, null, null], orgRole: 'EMPLOYEE', track: 'TRS', baseCode: 'NZV_BPO', supervisorLogin: 'demo_coord_nzv_1' },
  { fullName: 'Orlova Natalia Denisovna', login: 'demo_extra_10', position: 'Technician drilling 3 extra', daysLeft: [null, null, null, null, null], orgRole: 'EMPLOYEE', track: 'TRS', baseCode: 'ASTR_BPO', supervisorLogin: 'demo_coord_astr_1' },
];

const NUMBER_PREFIX = ['ОТ', 'ЭБ', 'ПБ', 'МЗ', 'ВР'];

/** Должность из справочника (создаётся, если её ещё нет). */
async function positionId(name: string, systemRoleCode = 'EMPLOYEE'): Promise<number> {
  const row = await prisma.position.upsert({ where: { name }, update: { systemRole: { connect: { code: systemRoleCode } } }, create: { name, systemRole: { connect: { code: systemRoleCode } } } });
  return row.id;
}

async function ensureDemoContracts(adminUserId: number) {
  const bases = await prisma.base.findMany({ where: { code: { in: ['NZV_BPO', 'ASTR_BPO'] }, isActive: true } });
  const status = await prisma.contractStatus.findUniqueOrThrow({ where: { code: 'ACTIVE' } });
  const customers = await Promise.all(Array.from({ length: 5 }, (_, index) => {
    const code = 'DEMO_CUSTOMER_' + String(index + 1).padStart(2, '0');
    return prisma.customer.upsert({ where: { code }, update: {}, create: { code, name: 'Demo Customer ' + (index + 1) } });
  }));
  let index = 0;
  for (const base of bases) for (let localIndex = 0; localIndex < 5; localIndex += 1) {
    const number = 'DEMO-2026-' + String(index + 1).padStart(3, '0');
    await prisma.contract.upsert({
      where: { baseId_number: { baseId: base.id, number } },
      update: {},
      create: { baseId: base.id, customerId: customers[index % customers.length].id, statusId: status.id, number, startsAt: new Date('2026-01-01T00:00:00.000Z'), endsAt: new Date('2027-12-31T00:00:00.000Z'), createdById: adminUserId },
    });
    index += 1;
  }
}

async function seedDemoSchedules() {
  const today = todayInTimezone('Europe/Moscow');
  const fixtures = [
    { login: 'ivanov', ranges: [{ offset: 0, days: 14, status: 'WORK' as const }, { offset: 14, days: 7, status: 'FREE_SHIFT' as const }] },
    { login: 'petrov', ranges: [{ offset: 3, days: 5, status: 'VACATION' as const }] },
    { login: 'sidorova', ranges: [{ offset: 7, days: 3, status: 'TRAINING' as const }] },
  ];

  for (const fixture of fixtures) {
    const user = await prisma.user.findUnique({ where: { login: fixture.login }, select: { id: true } });
    if (!user) continue;

    const [intervalCount, dailyCount] = await Promise.all([
      prisma.workScheduleInterval.count({ where: { userId: user.id } }),
      prisma.workScheduleEntry.count({ where: { userId: user.id } }),
    ]);
    if (intervalCount > 0 || dailyCount > 0) continue;

    for (const range of fixture.ranges) {
      await setScheduleRange(user.id, {
        userId: user.id,
        startDate: addDays(today, range.offset),
        endDate: addDays(today, range.offset + range.days - 1),
        status: range.status,
      });
    }
  }
}

async function main() {
  const existingDemoCount = await prisma.user.count({ where: { login: { in: EMPLOYEES.map((employee) => employee.login) } } });
  const allDemoUsersExist = existingDemoCount === EMPLOYEES.length;

  const admin = await prisma.user.findFirst({ where: { isDeleted: false, systemRoles: { some: { revokedAt: null, systemRole: { code: 'ADMIN', isActive: true } } } }, orderBy: { id: 'asc' } });
  if (!admin) throw new Error('Нет администратора — сначала выполните npm run db:seed');
  await ensureDemoContracts(admin.id);
  if (allDemoUsersExist) {
    await seedDemoSchedules();
    console.log('All demo employees and demo contracts are already present.');
    return;
  }
  const settingsTz = 'Europe/Moscow';
  const today = todayInTimezone(settingsTz);

  // Справочник: позиции из основного seed + одна новая (покажет автодобавление всем сотрудникам)
  const baseItems = await prisma.credential.findMany({ where: { isArchived: false }, orderBy: { sortOrder: 'asc' } });
  if (baseItems.length < 4) throw new Error('В справочнике меньше 4 позиций — выполните npm run db:seed');

  // Второй администратор — можно войти сразу, без смены пароля
  const adminPositionId = await positionId('HR Specialist', 'ADMIN');
  let admin2 = await prisma.user.findUnique({ where: { login: 'kovaleva' } });
  if (!admin2) {
    await users.create(admin, { fullName: 'Kovaleva Maria Petrovna', login: 'kovaleva', password: DEMO_PASSWORD, positionId: adminPositionId, email: 'kovaleva@example.com' });
    admin2 = await prisma.user.findUniqueOrThrow({ where: { login: 'kovaleva' } });
  }
  if (admin2.positionId !== adminPositionId) {
    await users.update(admin, admin2.id, { positionId: adminPositionId });
    admin2 = await prisma.user.findUniqueOrThrow({ where: { login: 'kovaleva' } });
  }
  await setAccountRoles(admin, admin2.id, { roles: ['ADMIN'] });
  await prisma.user.update({ where: { id: admin2.id }, data: { mustChangePassword: false } });
  const actor = await prisma.user.findUniqueOrThrow({ where: { id: admin2.id } });

  // Сотрудники
  const created: { id: number; spec: (typeof EMPLOYEES)[number] }[] = [];
  for (const spec of EMPLOYEES) {
    const positionIdValue = await positionId(spec.position, spec.orgRole ?? 'EMPLOYEE');
    let row = await prisma.user.findUnique({ where: { login: spec.login } });
    if (!row) {
      await users.create(actor, { fullName: spec.fullName, login: spec.login, password: DEMO_PASSWORD, positionId: positionIdValue, phone: '+7 (900) 000-' + String(10 + created.length).padStart(2, '0') + '-' + String(20 + created.length * 3).padStart(2, '0') });
      row = await prisma.user.findUniqueOrThrow({ where: { login: spec.login } });
    } else if (row.positionId !== positionIdValue) {
      await users.update(actor, row.id, { positionId: positionIdValue });
      row = await prisma.user.findUniqueOrThrow({ where: { login: spec.login } });
    }
    if (!spec.mustChangePassword && row.mustChangePassword) await prisma.user.update({ where: { id: row.id }, data: { mustChangePassword: false } });
    created.push({ id: row.id, spec });
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
    const desiredPositionId = await positionId(spec.position, spec.orgRole ?? 'EMPLOYEE');
    const desiredBaseId = spec.baseCode ? baseByCode.get(spec.baseCode) ?? null : null;
    const currentAssignment = await prisma.employeeAssignment.findUnique({ where: { activeEmployeeId: employee.id } });
    if (currentAssignment?.track === spec.track && currentAssignment.positionId === desiredPositionId && currentAssignment.baseId === desiredBaseId) continue;
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
      positionId: await positionId(spec.position, spec.orgRole ?? 'EMPLOYEE'),
      startsAt: today,
      reason: 'Синтетическое демо-назначение',
    });
  }

  if (existingDemoCount > 0) { console.log('Missing demo employees and assignments added; existing demo activity was left unchanged.'); return; }

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

  const byLogin = async (login: string) => {
    const user = await prisma.user.findUnique({ where: { login }, select: { id: true } });
    if (!user) throw new Error(`Demo seed expected employee '${login}', but no account exists`);
    return user.id;
  };

  // Кладовщику работы на высоте не нужны — пометка на удаление
  const vasilievaHeight = await prisma.userCredential.findFirstOrThrow({
    where: { userId: await byLogin('vasilieva'), credentialId: height.id },
  });
  await credentials.adminMark(actor, vasilievaHeight.id);

  // Комментарий к просроченному удостоверению
  const petrovOt = await prisma.userCredential.findFirstOrThrow({
    where: { userId: await byLogin('petrov'), credentialId: items[0].id },
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
    userId: await byLogin('petrov'),
    subject: 'Просрочено удостоверение по охране труда',
    body: 'Пётр Сергеевич, срок вашего удостоверения по охране труда истёк. Пожалуйста, внесите новую дату выдачи после обучения.',
  });
  await messages.send(actor, {
    recipient: 'user',
    userId: await byLogin('morozova'),
    subject: 'Добро пожаловать',
    body: 'Ольга Игоревна, заполните, пожалуйста, даты выдачи ваших удостоверений в разделе «Мои удостоверения».',
  });

  // Уведомления о сроках сотрудникам и копии администраторам
  await checkExpiryNotifications();

  // Сидорова уже всё прочитала
  await prisma.notification.updateMany({ where: { userId: await byLogin('sidorova') }, data: { readAt: new Date() } });

  await seedDemoSchedules();
  console.log(`Демо-данные загружены: ${created.length} сотрудников, 1 администратор, пароль у всех — ${DEMO_PASSWORD}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
