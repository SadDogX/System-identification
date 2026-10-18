import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, addMonths, daysBetween, todayInTimezone } from './dates.ts';
import { daysLeftText, expiryRangeForStatus, getCredentialStatus } from './status.ts';
import { createUserSchema, sendMessageSchema, credentialListQuerySchema } from './schemas.ts';
import { parse } from './validation.ts';

const today = '2026-10-11';
const at = (days: number) => addDays(today, days);

describe('getCredentialStatus', () => {
  const cases = [
    [91, 'GREEN'],
    [90, 'YELLOW'],
    [11, 'YELLOW'],
    [10, 'RED'],
    [0, 'RED'],
    [-1, 'RED'],
    [-400, 'RED'],
  ] as const;
  for (const [days, expected] of cases) {
    it(`${days} дней → ${expected}`, () => {
      assert.deepEqual(getCredentialStatus(at(days), today), { status: expected, daysLeft: days });
    });
  }

  it('нет даты → WHITE', () => {
    assert.deepEqual(getCredentialStatus(null, today), { status: 'WHITE', daysLeft: null });
  });

  it('учитывает настраиваемые пороги', () => {
    const t = { yellowDays: 30, redDays: 5 };
    assert.equal(getCredentialStatus(at(31), today, t).status, 'GREEN');
    assert.equal(getCredentialStatus(at(30), today, t).status, 'YELLOW');
    assert.equal(getCredentialStatus(at(5), today, t).status, 'RED');
  });
});

describe('expiryRangeForStatus согласован с getCredentialStatus', () => {
  it('каждый день от -5 до 120 попадает ровно в диапазон своего статуса', () => {
    for (let d = -5; d <= 120; d++) {
      const date = at(d);
      const { status } = getCredentialStatus(date, today);
      for (const s of ['GREEN', 'YELLOW', 'RED'] as const) {
        const r = expiryRangeForStatus(s, today);
        const inRange = (!r.gte || date >= r.gte) && (!r.lte || date <= r.lte);
        assert.equal(inRange, s === status, `${d} дней, диапазон ${s}`);
      }
    }
  });
});

describe('даты', () => {
  it('addMonths берёт конец месяца, если дня нет', () => {
    assert.equal(addMonths('2026-01-31', 1), '2026-02-28');
    assert.equal(addMonths('2028-01-31', 1), '2028-02-29');
    assert.equal(addMonths('2026-03-31', 1), '2026-04-30');
    assert.equal(addMonths('2026-05-15', 12), '2027-05-15');
    assert.equal(addMonths('2026-12-10', 3), '2027-03-10');
  });

  it('daysBetween', () => {
    assert.equal(daysBetween('2026-10-11', '2026-10-11'), 0);
    assert.equal(daysBetween('2026-10-11', '2027-10-11'), 365);
    assert.equal(daysBetween('2026-10-11', '2026-10-01'), -10);
  });

  it('todayInTimezone считает дату по Москве, а не по UTC', () => {
    // 22:30 UTC 10 октября = 01:30 МСК 11 октября
    const now = new Date('2026-10-10T22:30:00Z');
    assert.equal(todayInTimezone('Europe/Moscow', now), '2026-10-11');
    assert.equal(todayInTimezone('UTC', now), '2026-10-10');
  });
});

describe('daysLeftText', () => {
  it('склоняет и различает истёкшие', () => {
    assert.equal(daysLeftText(null), 'Не заполнено');
    assert.equal(daysLeftText(0), 'истекает сегодня');
    assert.equal(daysLeftText(1), 'осталось 1 день');
    assert.equal(daysLeftText(3), 'осталось 3 дня');
    assert.equal(daysLeftText(11), 'осталось 11 дней');
    assert.equal(daysLeftText(21), 'осталось 21 день');
    assert.equal(daysLeftText(-3), 'истекло 3 дня назад');
  });
});

describe('валидация', () => {
  it('обрезает пробелы, отбрасывает лишние поля, пустые строки → null', () => {
    const r = parse(createUserSchema, {
      fullName: '  Иванов Иван ',
      login: 'ivanov',
      password: 'password1',
      role: 'USER',
      phone: '',
      isAdmin: true,
    });
    assert.ok(r.ok);
    assert.deepEqual(r.value, { fullName: 'Иванов Иван', login: 'ivanov', password: 'password1', role: 'USER', phone: null });
  });

  it('собирает сообщения по полям', () => {
    const r = parse(createUserSchema, { fullName: '', login: 'и', password: '123', role: 'ROOT', email: 'x' });
    assert.ok(!r.ok);
    assert.deepEqual(Object.keys(r.issues).sort(), ['email', 'fullName', 'login', 'password', 'role']);
  });

  it('проверка всего объекта', () => {
    const r = parse(sendMessageSchema, { recipient: 'user', subject: 'Тема', body: 'Текст' });
    assert.ok(!r.ok);
    assert.equal(r.issues.userId, 'Выберите получателя');
  });

  it('query-параметры приводятся к типам и получают значения по умолчанию', () => {
    const r = parse(credentialListQuerySchema, { status: 'RED', credentialId: '3', marked: 'true' });
    assert.ok(r.ok);
    assert.deepEqual(r.value, { status: 'RED', credentialId: 3, marked: true, page: 1, pageSize: 50 });
  });
});
