import { describe, expect, it } from 'vitest';
import { addDays, addMonths, daysBetween, todayInTimezone } from './dates';
import { daysLeftText, expiryRangeForStatus, getCredentialStatus } from './status';

const today = '2026-10-11';
const at = (days: number) => addDays(today, days);

describe('getCredentialStatus', () => {
  it.each([
    [91, 'GREEN'],
    [90, 'YELLOW'],
    [11, 'YELLOW'],
    [10, 'RED'],
    [0, 'RED'],
    [-1, 'RED'],
    [-400, 'RED'],
  ] as const)('%i дней → %s', (days, expected) => {
    expect(getCredentialStatus(at(days), today)).toEqual({ status: expected, daysLeft: days });
  });

  it('нет даты → WHITE', () => {
    expect(getCredentialStatus(null, today)).toEqual({ status: 'WHITE', daysLeft: null });
  });

  it('учитывает настраиваемые пороги', () => {
    const t = { yellowDays: 30, redDays: 5 };
    expect(getCredentialStatus(at(31), today, t).status).toBe('GREEN');
    expect(getCredentialStatus(at(30), today, t).status).toBe('YELLOW');
    expect(getCredentialStatus(at(5), today, t).status).toBe('RED');
  });
});

describe('expiryRangeForStatus согласован с getCredentialStatus', () => {
  it('каждый день от -5 до 120 попадает ровно в один диапазон своего статуса', () => {
    for (let d = -5; d <= 120; d++) {
      const date = at(d);
      const { status } = getCredentialStatus(date, today);
      for (const s of ['GREEN', 'YELLOW', 'RED'] as const) {
        const r = expiryRangeForStatus(s, today);
        const inRange = (!r.gte || date >= r.gte) && (!r.lte || date <= r.lte);
        expect(inRange, `${d} дней, диапазон ${s}`).toBe(s === status);
      }
    }
  });
});

describe('даты', () => {
  it('addMonths берёт конец месяца, если дня нет', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
    expect(addMonths('2026-03-31', 1)).toBe('2026-04-30');
    expect(addMonths('2026-05-15', 12)).toBe('2027-05-15');
    expect(addMonths('2026-12-10', 3)).toBe('2027-03-10');
  });

  it('daysBetween', () => {
    expect(daysBetween('2026-10-11', '2026-10-11')).toBe(0);
    expect(daysBetween('2026-10-11', '2027-10-11')).toBe(365);
    expect(daysBetween('2026-10-11', '2026-10-01')).toBe(-10);
  });

  it('todayInTimezone считает дату по Москве, а не по UTC', () => {
    // 22:30 UTC 10 октября = 01:30 МСК 11 октября
    const now = new Date('2026-10-10T22:30:00Z');
    expect(todayInTimezone('Europe/Moscow', now)).toBe('2026-10-11');
    expect(todayInTimezone('UTC', now)).toBe('2026-10-10');
  });
});

describe('daysLeftText', () => {
  it('склоняет и различает истёкшие', () => {
    expect(daysLeftText(null)).toBe('Не заполнено');
    expect(daysLeftText(0)).toBe('истекает сегодня');
    expect(daysLeftText(1)).toBe('осталось 1 день');
    expect(daysLeftText(3)).toBe('осталось 3 дня');
    expect(daysLeftText(11)).toBe('осталось 11 дней');
    expect(daysLeftText(21)).toBe('осталось 21 день');
    expect(daysLeftText(-3)).toBe('истекло 3 дня назад');
  });
});
