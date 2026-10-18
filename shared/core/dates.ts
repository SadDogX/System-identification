// Все даты удостоверений — календарные дни без времени в формате 'YYYY-MM-DD'.

export const DEFAULT_TIMEZONE = 'Europe/Moscow';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** Текущая календарная дата в заданном часовом поясе. */
export function todayInTimezone(timeZone: string = DEFAULT_TIMEZONE, now: Date = new Date()): string {
  // en-CA форматирует дату как YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

function toUtcMs(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function fromUtcMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Количество дней от `from` до `to` (отрицательное, если `to` раньше). */
export function daysBetween(from: string, to: string): number {
  return Math.round((toUtcMs(to) - toUtcMs(from)) / 86_400_000);
}

export function addDays(date: string, days: number): string {
  return fromUtcMs(toUtcMs(date) + days * 86_400_000);
}

/**
 * Прибавляет месяцы к дате. Если в целевом месяце нет такого дня,
 * берётся последний день месяца (31.01 + 1 мес. = 28/29.02).
 */
export function addMonths(date: string, months: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const targetMonthIndex = m - 1 + months;
  const lastDay = new Date(Date.UTC(y, targetMonthIndex + 1, 0)).getUTCDate();
  return fromUtcMs(Date.UTC(y, targetMonthIndex, Math.min(d, lastDay)));
}

/** 'YYYY-MM-DD' → 'DD.MM.YYYY' */
export function formatDateRu(date: string | null | undefined): string {
  if (!date) return '—';
  const [y, m, d] = date.split('-');
  return `${d}.${m}.${y}`;
}
