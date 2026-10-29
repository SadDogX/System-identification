import type { WorkDayStatus } from '@app/shared';

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
