import { availableParallelism } from 'node:os';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Не задана переменная окружения ${name}`);
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 4100),
  isProduction: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',
  /**
   * Число рабочих процессов (ядер). Пусто — в продакшене все ядра, в разработке 1.
   * Каждый процесс держит свой пул соединений с БД — учитывайте лимит MySQL.
   */
  workers: process.env.CLUSTER_WORKERS
    ? Math.max(1, Number(process.env.CLUSTER_WORKERS))
    : process.env.NODE_ENV === 'production'
      ? availableParallelism()
      : 1,
  jwtAccessSecret: required('JWT_ACCESS_SECRET'),
  jwtRefreshSecret: required('JWT_REFRESH_SECRET'),
  accessTokenTtlSeconds: 15 * 60,
  refreshTokenTtlDays: 7,
  /** Адрес приложения — для ссылок в письмах. */
  appUrl: process.env.APP_URL ?? `http://localhost:${process.env.PORT ?? 4100}`,
  /** Почта: включается, если задан SMTP_HOST. */
  smtp: process.env.SMTP_HOST
    ? {
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT ?? 587),
        secure: process.env.SMTP_SECURE === 'true',
        user: process.env.SMTP_USER || undefined,
        pass: process.env.SMTP_PASS || undefined,
        from: process.env.SMTP_FROM ?? 'Учёт удостоверений <noreply@localhost>',
      }
    : null,
  /** Фото и сканы удостоверений. */
  uploadsDir: process.env.UPLOADS_DIR
    ? pathToFileURL(resolve(process.env.UPLOADS_DIR) + '/')
    : new URL('../../uploads/credentials/', import.meta.url),
  /** Собранный клиент, который раздаёт этот же сервер. */
  clientDist: new URL('../../../web/dist/', import.meta.url),
};
