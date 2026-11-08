export const SYSTEM_ROLE_CODES = [
  'ADMIN',
  'MANAGER',
  'COORDINATOR',
  'SENIOR_MECHANIC',
  'MECHANIC',
  'SHOP_FOREMAN',
  'SHOP_EMPLOYEE',
  'EMPLOYEE',
] as const;

export type SystemRoleCode = (typeof SYSTEM_ROLE_CODES)[number];

export const SYSTEM_ROLE_DIRECTORY: Record<SystemRoleCode, { name: string; description: string }> = {
  ADMIN: { name: 'Администратор', description: 'Полный административный доступ.' },
  MANAGER: { name: 'Менеджер', description: 'Управление назначениями и работами в своей базе.' },
  COORDINATOR: { name: 'Координатор', description: 'Координация назначенных месторождений и команды.' },
  SENIOR_MECHANIC: { name: 'Старший механик', description: 'Межбазовое руководство механиками.' },
  MECHANIC: { name: 'Механик', description: 'Работа в техническом подразделении.' },
  SHOP_FOREMAN: { name: 'Мастер цеха', description: 'Руководство цеховой командой.' },
  SHOP_EMPLOYEE: { name: 'Сотрудник цеха', description: 'Работа в цеховом подразделении.' },
  EMPLOYEE: { name: 'Сотрудник', description: 'Базовый доступ сотрудника без управленческих разрешений.' },
};
