import { translate, type Language } from './i18n.ts';
import { getCurrentLanguage } from './languageState.ts';
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

export function statusLabels(language: Language = getCurrentLanguage()): Record<CredentialStatus, string> {
  return { GREEN: translate(language, 'status.GREEN'), YELLOW: translate(language, 'status.YELLOW'), RED: translate(language, 'status.RED'), WHITE: translate(language, 'status.WHITE') };
}

export const STATUS_LABELS: Record<CredentialStatus, string> = statusLabels();
export const STATUS_MESSAGE_KEYS: Record<CredentialStatus, string> = { GREEN: 'status.GREEN', YELLOW: 'status.YELLOW', RED: 'status.RED', WHITE: 'status.WHITE' };

export function daysLeftText(daysLeft: number | null, language: Language = getCurrentLanguage()): string {
  if (daysLeft === null) return translate(language, 'status.notFilled');
  if (daysLeft === 0) return translate(language, 'status.expiresToday');
  const count = Math.abs(daysLeft);
  const key = daysLeft > 0
    ? (count === 1 ? 'status.remainingOne' : count < 5 ? 'status.remainingFew' : 'status.remainingMany')
    : (count === 1 ? 'status.expiredOne' : count < 5 ? 'status.expiredFew' : 'status.expiredMany');
  return translate(language, key, { count });
}
