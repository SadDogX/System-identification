import type { WorkDayStatus } from '@app/shared';

export type CustomerSiteWorkStatus = 'PAST' | 'UPCOMING' | 'ACTIVE' | 'OVERLAP';

export const CUSTOMER_SITE_WORK_COLORS: Record<CustomerSiteWorkStatus, string> = {
  PAST: '#9ca3af',
  UPCOMING: '#f2c94c',
  ACTIVE: '#1f4e79',
  OVERLAP: '#c62828',
};

export const getCustomerSiteWorkStatus = (startsAt: string, expectedEndAt: string, hasOverlap: boolean, now = new Date()): CustomerSiteWorkStatus => {
  if (hasOverlap) return 'OVERLAP';
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  if (expectedEndAt < today) return 'PAST';
  if (startsAt > today) return 'UPCOMING';
  return 'ACTIVE';
};

export const WORK_SCHEDULE_LABELS: Record<WorkDayStatus, string> = {
  WORK: 'Работа',
  FREE_SHIFT: 'Свободная вахта',
  TRAVEL: 'Дорога',
  SICK_LEAVE: 'Больничный',
  VACATION: 'Отпуск',
  TRAINING: 'Обучение',
};

export const WORK_SCHEDULE_CODES: Record<WorkDayStatus, string> = {
  WORK: 'W',
  FREE_SHIFT: 'F',
  TRAVEL: 'T',
  SICK_LEAVE: 'S',
  VACATION: 'V',
  TRAINING: 'TR',
};

export const WORK_SCHEDULE_COLORS: Record<WorkDayStatus, string> = {
  WORK: '#1f4e79',
  FREE_SHIFT: '#2e7d32',
  TRAVEL: '#f2c94c',
  SICK_LEAVE: '#c62828',
  VACATION: '#8e44ad',
  TRAINING: '#00838f',
};

export const getScheduleDates = (year: number) => {
  const dates: string[] = [];
  for (let date = new Date(Date.UTC(year, 0, 1)); date.getUTCFullYear() === year; date.setUTCDate(date.getUTCDate() + 1)) {
    dates.push(date.toISOString().slice(0, 10));
  }
  return dates;
};

export const getScheduleMonthName = (month: number) =>
  new Intl.DateTimeFormat('ru-RU', { month: 'long' }).format(new Date(2020, month, 1));
