function plural(n: number, forms: [string, string, string]): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return forms[2];
  if (last === 1) return forms[0];
  if (last >= 2 && last <= 4) return forms[1];
  return forms[2];
}

/** 36 → «3 года», 18 → «18 месяцев». */
export function formatValidity(months: number): string {
  if (months % 12 === 0) {
    const years = months / 12;
    return `${years} ${plural(years, ['год', 'года', 'лет'])}`;
  }
  return `${months} ${plural(months, ['месяц', 'месяца', 'месяцев'])}`;
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('ru-RU', {
    timeZone: 'Europe/Moscow',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const ROLE_LABELS = { ADMIN: 'Администратор', USER: 'Сотрудник' } as const;
