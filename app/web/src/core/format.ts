import { getCurrentLanguage } from '@app/shared';

function part(value: string, forms: [string, string, string]) {
  const abs = Math.abs(value as unknown as number);
  if (abs > 10 && abs < 20) return forms[2];
  const n = abs % 10;
  return n === 1 ? forms[0] : n >= 2 && n <= 4 ? forms[1] : forms[2];
}

export function formatDateTimeDisplay(iso: string, language: 'ru' | 'en' = getCurrentLanguage()) {
  return new Date(iso).toLocaleString(language === 'ru' ? 'ru-RU' : 'en-GB', { timeZone: 'Europe/Moscow', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function formatDateDisplay(value: string | null | undefined, language: 'ru' | 'en' = getCurrentLanguage()) {
  if (!value) return '—';
  const [year, month, day] = value.split('-');
  return language === 'ru' ? `${day}.${month}.${year}` : `${day}/${month}/${year}`;
}

export function validityDisplay(months: number, language: 'ru' | 'en' = getCurrentLanguage()) {
  if (language === 'en') return months % 12 === 0 ? `${months / 12} ${months === 12 ? 'year' : 'years'}` : `${months} months`;
  const value = months % 12 === 0 ? months / 12 : months;
  const forms: [string, string, string] = months % 12 === 0 ? ['год', 'года', 'лет'] : ['месяц', 'месяца', 'месяцев'];
  return `${value} ${part(value.toString(), forms)}`;
}
