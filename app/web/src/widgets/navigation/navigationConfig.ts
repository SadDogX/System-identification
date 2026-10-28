import type { UserDto } from '@app/shared';
import type { IconName } from '@app/shared/ui';

export interface NavItem {
  to: string;
  label: string;
  icon: IconName;
}

export interface NavSubgroup {
  label: string;
  icon: IconName;
  items: NavItem[];
}

export interface NavGroup {
  label: string;
  icon: IconName;
  items?: NavItem[];
  subgroups?: NavSubgroup[];
}

const USER_ITEMS: NavItem[] = [
  { to: '/user/organization', label: 'Моя база и команда', icon: 'people' },
  { to: '/user/work-execution', label: 'Договоры и работы', icon: 'doneAll' },
  { to: '/user/credentials', label: 'Удостоверения', icon: 'badge' },
];

const ADMIN_PEOPLE_ITEMS: NavItem[] = [
  { to: '/admin/overview', label: 'Список удостоверений', icon: 'overview' },
  { to: '/admin/credentials', label: 'Записи удостоверений', icon: 'badge' },
];

const WPTS_ITEMS: NavItem[] = [
  { to: '/admin/radar-cards', label: 'Радар карты', icon: 'warning' },
  { to: '/admin/ifo', label: 'IFO', icon: 'overview' },
];

const USER_WPTS_ITEMS: NavItem[] = [
  { to: '/user/radar-cards', label: 'Радар карты', icon: 'warning' },
  { to: '/user/ifo', label: 'IFO', icon: 'overview' },
];

const ROOT_ADMIN_ITEMS: NavItem[] = [
  { to: '/admin/notifications', label: 'Уведомления', icon: 'bell' },
  { to: '/admin/messages', label: 'Сообщения', icon: 'send' },
  { to: '/admin/audit-log', label: 'Аудит и логи', icon: 'history' },
];

const ROOT_USER_ITEMS: NavItem[] = [
  { to: '/user/notifications', label: 'Уведомления', icon: 'bell' },
];

const SCHEDULE_ADMIN_ITEMS: NavItem[] = [
  { to: '/admin/work-schedule', label: 'Таблица', icon: 'table' },
  { to: '/admin/work-schedule/calendar', label: 'Редактирование', icon: 'overview' },
  { to: '/admin/work-schedule/shift-partners', label: 'Генерация сменщиков', icon: 'people' },
];

const SCHEDULE_USER_ITEMS: NavItem[] = [
  { to: '/user/work-schedule', label: 'Таблица', icon: 'table' },
  { to: '/user/work-schedule/calendar', label: 'Мой график', icon: 'overview' },
];

const ADMIN_NAV_GROUPS: NavGroup[] = [
  {
    label: 'Обзор',
    icon: 'dashboard',
    items: [{ to: '/admin/dashboard', label: 'Панель управления', icon: 'dashboard' }],
  },
  {
    label: 'Сотрудники',
    icon: 'people',
    subgroups: [
      { label: 'Удостоверения', icon: 'badge', items: ADMIN_PEOPLE_ITEMS },
      { label: 'WPTS', icon: 'grid', items: WPTS_ITEMS },
      { label: 'Учёт графиков', icon: 'table', items: SCHEDULE_ADMIN_ITEMS },
    ],
  },
  { label: 'Оборудование', icon: 'grid', items: [{ to: '/admin/equipment', label: 'Оборудование', icon: 'grid' }] },
  {
    label: 'Организация БПО',
    icon: 'people',
    items: [
      { to: '/admin/org/personnel', label: 'Персонал', icon: 'people' },
      { to: '/admin/dictionaries/employees', label: 'Добавить сотрудника', icon: 'add' },
      { to: '/admin/org/assignments', label: 'Назначения', icon: 'doneAll' },
      { to: '/admin/org/transfers', label: 'Переводы', icon: 'history' },
      { to: '/admin/org/contracts', label: 'Договоры', icon: 'book' },
      { to: '/admin/organization', label: 'Месторождения и скважины', icon: 'grid' },
    ],
  },
  {
    label: 'Справочники',
    icon: 'book',
    items: [
      { to: '/admin/dictionaries/bases', label: 'Базы', icon: 'grid' },
      { to: '/admin/dictionaries/organization', label: 'Статусы и виды работ', icon: 'book' },
      { to: '/admin/positions', label: 'Должности', icon: 'work' },
      { to: '/admin/catalog', label: 'Удостоверения', icon: 'badge' },
    ],
  },
  { label: 'Общие разделы', icon: 'grid', items: ROOT_ADMIN_ITEMS },
];

const USER_NAV_GROUPS: NavGroup[] = [
  {
    label: 'Обзор',
    icon: 'dashboard',
    items: [{ to: '/user/dashboard', label: 'Панель управления', icon: 'dashboard' }],
  },
  {
    label: 'Сотрудники',
    icon: 'people',
    subgroups: [
      { label: 'Работа и удостоверения', icon: 'badge', items: USER_ITEMS },
      { label: 'WPTS', icon: 'grid', items: USER_WPTS_ITEMS },
      { label: 'Учёт графиков', icon: 'table', items: SCHEDULE_USER_ITEMS },
    ],
  },
  { label: 'Общие разделы', icon: 'grid', items: ROOT_USER_ITEMS },
];

const LEAD_NAV_GROUPS: NavGroup[] = [
  ...USER_NAV_GROUPS,
  {
    label: 'Моя команда',
    icon: 'people',
    items: [
      { to: '/admin/dashboard', label: 'Сводка команды', icon: 'dashboard' },
      { to: '/admin/overview', label: 'Удостоверения команды', icon: 'overview' },
      { to: '/admin/credentials', label: 'Записи удостоверений', icon: 'badge' },
    ],
  },
];

const CREDENTIAL_LEAD_NAV_GROUPS: NavGroup[] = [
  ...USER_NAV_GROUPS,
  {
    label: 'Моя команда',
    icon: 'people',
    items: [{ to: '/admin/credentials', label: 'Записи удостоверений', icon: 'badge' }],
  },
];

export function resolveNavGroups(user: UserDto): NavGroup[] {
  if (user.role === 'ADMIN') return ADMIN_NAV_GROUPS;

  const isLead = user.systemRoles.some((role) => ['MANAGER', 'COORDINATOR', 'SENIOR_MECHANIC'].includes(role));
  const isCredentialLead = user.systemRoles.some((role) => ['MECHANIC', 'SHOP_FOREMAN'].includes(role));

  if (isLead) return LEAD_NAV_GROUPS;
  if (isCredentialLead) return CREDENTIAL_LEAD_NAV_GROUPS;
  return USER_NAV_GROUPS;
}

export function isNavItemActive(path: string, to: string) {
  return path === to;
}

export function groupHasActivePath(group: NavGroup, path: string) {
  return [...(group.items ?? []), ...(group.subgroups ?? []).flatMap((subgroup) => subgroup.items)].some(
    (item) => isNavItemActive(path, item.to),
  );
}

export function subgroupHasActivePath(group: NavSubgroup, path: string) {
  return group.items.some((item) => isNavItemActive(path, item.to));
}
