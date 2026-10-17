import { DEFAULT_TIMEZONE } from '@app/shared';
import { logger } from '../utils/logger.ts';
import { checkExpiryNotifications, sendAdminEmailDigest } from '../services/notifications.service.ts';

const RUN_HOUR = 8; // 08:00 по Москве
const TICK_MS = 10 * 60 * 1000;

/** Проверка сроков. Вынесена отдельно, чтобы позже перенести в worker/очередь. */
export async function runExpiryCheck() {
  const created = await checkExpiryNotifications();
  const emails = await sendAdminEmailDigest();
  logger.info(`Проверка сроков удостоверений: новых уведомлений ${created}, писем администраторам ${emails}`);
}

function moscowNow() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: DEFAULT_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return { date: `${get('year')}-${get('month')}-${get('day')}`, hour: Number(get('hour')) };
}

/**
 * Простой планировщик без внешних модулей: раз в 10 минут проверяет,
 * наступило ли 08:00 по Москве и запускалась ли проверка сегодня.
 * Плюс запуск при старте — дубли отсекает dedupKey.
 */
export function scheduleExpiryCheck() {
  let lastRunDate = '';
  const run = () => runExpiryCheck().catch((err) => logger.error('Ошибка проверки сроков', err));

  run();
  const timer = setInterval(() => {
    const now = moscowNow();
    if (now.hour >= RUN_HOUR && now.date !== lastRunDate) {
      lastRunDate = now.date;
      run();
    }
  }, TICK_MS);
  timer.unref();
}
