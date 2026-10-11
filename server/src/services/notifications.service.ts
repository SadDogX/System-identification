import type { Prisma } from '@prisma/client';
import {
  addDays,
  daysLeftText,
  getCredentialStatus,
  type NotificationDto,
  type Paginated,
} from '@app/shared';
import { prisma } from '../db';
import { notFound } from '../utils/errors';
import { fromDbDate, toDbDate } from '../utils/dates';
import { getDateContext } from './settings.service';
import { statusWhere, visibleCredentialWhere } from './credentialFilters';

/** Дополнительный порог между «жёлтым» и «красным». */
const EXTRA_THRESHOLD_DAYS = 30;

function toDto(n: Prisma.NotificationGetPayload<object>): NotificationDto {
  return {
    id: n.id,
    kind: n.kind,
    level: (n.level as NotificationDto['level']) ?? null,
    title: n.title,
    body: n.body,
    link: n.link,
    readAt: n.readAt?.toISOString() ?? null,
    createdAt: n.createdAt.toISOString(),
  };
}

/**
 * Создаёт уведомления о приближении окончания сроков.
 * Для каждой записи создаётся одно уведомление на самый «строгий» достигнутый порог
 * (90 / 30 / 10 / 0 дней). Ключ дедупликации включает дату окончания, поэтому
 * повторный запуск не плодит дубли, а после продления дат уведомления пойдут заново.
 */
export async function checkExpiryNotifications(opts: { userCredentialId?: number } = {}) {
  const { settings, today } = await getDateContext();
  const thresholds = [...new Set([settings.yellowDays, EXTRA_THRESHOLD_DAYS, settings.redDays, 0])]
    .filter((t) => t <= settings.yellowDays)
    .sort((a, b) => a - b);

  const rows = await prisma.userCredential.findMany({
    where: {
      ...(opts.userCredentialId && { id: opts.userCredentialId }),
      isMarkedForDeletion: false,
      credential: { isArchived: false },
      user: { role: 'USER', isDeleted: false, isActive: true },
      expiryDate: { not: null, lte: toDbDate(addDays(today, settings.yellowDays)) },
    },
    include: { credential: true },
  });

  const data: Prisma.NotificationCreateManyInput[] = [];
  for (const row of rows) {
    const expiryDate = fromDbDate(row.expiryDate)!;
    const { status, daysLeft } = getCredentialStatus(expiryDate, today, settings);
    const threshold = thresholds.find((t) => daysLeft! <= t);
    if (threshold === undefined) continue;
    const title =
      daysLeft! < 0
        ? `«${row.credential.name}»: срок действия ${daysLeftText(daysLeft)}`
        : `«${row.credential.name}» ${daysLeft === 0 ? 'истекает сегодня' : `заканчивается через ${daysLeft} дн.`}`;
    data.push({
      userId: row.userId,
      kind: 'EXPIRY',
      level: status,
      title,
      body: `Действительно до ${expiryDate.split('-').reverse().join('.')}. Обновите данные удостоверения.`,
      link: '/user/credentials',
      dedupKey: `exp:${row.id}:${expiryDate}:${threshold}`,
    });
  }
  if (data.length > 0) await prisma.notification.createMany({ data, skipDuplicates: true });
  return data.length;
}

/** Ежедневная сводка администраторам — одно уведомление вместо отдельного на каждого сотрудника. */
export async function createAdminDigest() {
  const { settings, today } = await getDateContext();
  const [red, yellow] = await Promise.all(
    (['RED', 'YELLOW'] as const).map((status) =>
      prisma.userCredential.count({
        where: { ...visibleCredentialWhere, ...statusWhere(status, today, settings) },
      }),
    ),
  );
  if (red + yellow === 0) return 0;

  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN', isDeleted: false, isActive: true },
    select: { id: true },
  });
  const parts = [red && `критичных — ${red}`, yellow && `требуют внимания — ${yellow}`].filter(Boolean);
  await prisma.notification.createMany({
    data: admins.map((a) => ({
      userId: a.id,
      kind: 'DIGEST' as const,
      level: red > 0 ? 'RED' : 'YELLOW',
      title: `Сводка по срокам: ${parts.join(', ')}`,
      body: 'Откройте список удостоверений, чтобы увидеть, у кого истекают сроки.',
      link: red > 0 ? '/admin/credentials?status=RED' : '/admin/credentials?status=YELLOW',
      dedupKey: `digest:${a.id}:${today}`,
    })),
    skipDuplicates: true,
  });
  return admins.length;
}

// ---------- Центр уведомлений ----------

export async function list(
  userId: number,
  query: { page: number; pageSize: number; kind?: 'MESSAGE' | 'EXPIRY' },
): Promise<Paginated<NotificationDto>> {
  const where: Prisma.NotificationWhereInput = {
    userId,
    ...(query.kind === 'MESSAGE' && { kind: 'MESSAGE' }),
    ...(query.kind === 'EXPIRY' && { kind: { in: ['EXPIRY', 'DIGEST'] } }),
  };
  const [rows, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.notification.count({ where }),
  ]);
  return { items: rows.map(toDto), total, page: query.page, pageSize: query.pageSize };
}

export const unreadCount = (userId: number) => prisma.notification.count({ where: { userId, readAt: null } });

export async function markRead(userId: number, id: number) {
  const result = await prisma.notification.updateMany({
    where: { id, userId, readAt: null },
    data: { readAt: new Date() },
  });
  if (result.count === 0 && !(await prisma.notification.findFirst({ where: { id, userId } }))) {
    throw notFound('Уведомление не найдено');
  }
}

export async function markAllRead(userId: number) {
  await prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
}
