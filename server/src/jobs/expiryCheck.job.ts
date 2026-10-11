import cron from 'node-cron';
import { DEFAULT_TIMEZONE } from '@app/shared';
import { logger } from '../utils/logger';
import { checkExpiryNotifications, createAdminDigest } from '../services/notifications.service';

/** Проверка сроков. Вынесена отдельно, чтобы позже перенести в worker/очередь. */
export async function runExpiryCheck() {
  const created = await checkExpiryNotifications();
  const digests = await createAdminDigest();
  logger.info({ created, digests }, 'Проверка сроков удостоверений выполнена');
}

export function scheduleExpiryCheck() {
  // Каждый день в 08:00 по Москве
  cron.schedule(
    '0 8 * * *',
    () => {
      runExpiryCheck().catch((err) => logger.error({ err }, 'Ошибка проверки сроков'));
    },
    { timezone: DEFAULT_TIMEZONE },
  );
  // И при старте — чтобы не ждать утра после перезапуска; дубли отсекает dedupKey
  runExpiryCheck().catch((err) => logger.error({ err }, 'Ошибка проверки сроков'));
}
