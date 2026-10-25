import { DEFAULT_TIMEZONE } from '@app/shared';
import { prisma } from '../../core/db.ts';
import { logger } from '../../core/logger.ts';
import { checkExpiryNotifications, sendAdminEmailDigest } from './notifications.service.ts';

const RUN_HOUR = 8;
const TICK_MS = 10 * 60 * 1000;

export async function runExpiryCheck() {
  const created = await checkExpiryNotifications();
  const emails = await sendAdminEmailDigest();
  const blocked = await prisma.user.updateMany({ where: { role: 'USER', isDeleted: false, isActive: true, credentials: { some: { expiryDate: { lte: new Date(Date.now() - 7 * 86400000), not: null }, isMarkedForDeletion: false } } }, data: { isActive: false, tokenVersion: { increment: 1 } } });
  logger.info(`Проверка сроков: уведомлений ${created}, писем ${emails}, автоблокировано ${blocked.count}`);
}

function moscowNow() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: DEFAULT_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return { date: `${get('year')}-${get('month')}-${get('day')}`, hour: Number(get('hour')) };
}

export function scheduleExpiryCheck() {
  let lastRunDate = '';
  const run = () => runExpiryCheck().catch((err) => logger.error('Ошибка проверки сроков', err));
  run();
  const timer = setInterval(() => { const now = moscowNow(); if (now.hour >= RUN_HOUR && now.date !== lastRunDate) { lastRunDate = now.date; run(); } }, TICK_MS);
  timer.unref();
}
