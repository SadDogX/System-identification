import { addDays, daysBetween } from './dates.ts';

export const CREDENTIAL_STATUSES = ['GREEN', 'YELLOW', 'RED', 'WHITE'] as const;
export type CredentialStatus = (typeof CREDENTIAL_STATUSES)[number];

export interface StatusThresholds {
  /** Больше этого числа дней — зелёный. */
  yellowDays: number;
  /** Это число дней и меньше (включая истёкшие) — красный. */
  redDays: number;
}

export const DEFAULT_THRESHOLDS: StatusThresholds = { yellowDays: 90, redDays: 10 };

export interface StatusInfo {
  status: CredentialStatus;
  /** null, если дата окончания не заполнена. */
  daysLeft: number | null;
}

export function getCredentialStatus(
  expiryDate: string | null | undefined,
  today: string,
  thresholds: StatusThresholds = DEFAULT_THRESHOLDS,
): StatusInfo {
  if (!expiryDate) return { status: 'WHITE', daysLeft: null };
  const daysLeft = daysBetween(today, expiryDate);
  if (daysLeft > thresholds.yellowDays) return { status: 'GREEN', daysLeft };
  if (daysLeft > thresholds.redDays) return { status: 'YELLOW', daysLeft };
  return { status: 'RED', daysLeft };
}

/**
 * Диапазон дат окончания, соответствующий статусу (включительно).
 * Используется сервером для фильтрации в БД — статус не хранится.
 * WHITE означает «дата отсутствует» и диапазоном не выражается.
 */
export function expiryRangeForStatus(
  status: Exclude<CredentialStatus, 'WHITE'>,
  today: string,
  thresholds: StatusThresholds = DEFAULT_THRESHOLDS,
): { gte?: string; lte?: string } {
  switch (status) {
    case 'GREEN':
      return { gte: addDays(today, thresholds.yellowDays + 1) };
    case 'YELLOW':
      return { gte: addDays(today, thresholds.redDays + 1), lte: addDays(today, thresholds.yellowDays) };
    case 'RED':
      return { lte: addDays(today, thresholds.redDays) };
  }
}

export const STATUS_LABELS: Record<CredentialStatus, string> = {
  GREEN: 'Действует',
  YELLOW: 'Требует внимания',
  RED: 'Критично',
  WHITE: 'Не заполнено',
};

function pluralDays(n: number): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return 'дней';
  if (last === 1) return 'день';
  if (last >= 2 && last <= 4) return 'дня';
  return 'дней';
}

/** Текст рядом с цветом: «осталось 45 дней», «истекло 3 дня назад». */
export function daysLeftText(daysLeft: number | null): string {
  if (daysLeft === null) return 'Не заполнено';
  if (daysLeft === 0) return 'истекает сегодня';
  if (daysLeft > 0) return `осталось ${daysLeft} ${pluralDays(daysLeft)}`;
  return `истекло ${-daysLeft} ${pluralDays(daysLeft)} назад`;
}
