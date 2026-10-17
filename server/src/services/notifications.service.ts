import type { Prisma } from '@prisma/client';
import {
  addDays,
  daysLeftText,
  formatDateRu,
  getCredentialStatus,
  type NotificationDto,
  type Paginated,
} from '@app/shared';
import { prisma } from '../db.ts';
import { notFound } from '../utils/errors.ts';
import { fromDbDate, toDbDate } from '../utils/dates.ts';
import { getDateContext } from './settings.service.ts';
import { statusWhere, visibleCredentialWhere } from './credentialFilters.ts';
import { expiryEmail, mailEnabled, sendMail, type ExpiryLine } from './mail.service.ts';

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

function expiryPhrase(name: string, daysLeft: number) {
  if (daysLeft < 0) return `«${name}»: срок действия ${daysLeftText(daysLeft)}`;
  if (daysLeft === 0) return `«${name}» истекает сегодня`;
  return `«${name}» заканчивается через ${daysLeft} дн.`;
}

/** Строка письма вместе с ключом уведомления, по которому видно, новое ли оно. */
type PendingLine = ExpiryLine & { key: string };

/** Активные администраторы — им дублируются уведомления по всем сотрудникам. */
export const activeAdmins = () =>
  prisma.user.findMany({ where: { role: 'ADMIN', isDeleted: false, isActive: true }, select: { id: true, email: true } });

/**
 * Создаёт уведомления о приближении окончания сроков (жёлтые и красные).
 * На каждую запись — одно уведомление на самый «строгий» достигнутый порог (90 / 30 / 10 / 0 дней)
 * сотруднику и копия каждому администратору. Ключ дедупликации включает дату окончания:
 * повторный запуск не плодит дубли, а после продления уведомления пойдут заново.
 * Сотрудник с email получает письмо со списком новых уведомлений.
 * Возвращает число новых уведомлений сотрудникам.
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
    include: { credential: true, user: { select: { id: true, fullName: true, email: true } } },
  });
  if (rows.length === 0) return 0;
  const admins = await activeAdmins();

  const candidates: (Prisma.NotificationCreateManyInput & { dedupKey: string })[] = [];
  const emailLines = new Map<number, { email: string | null; fullName: string; lines: PendingLine[] }>();
  const userKeys = new Set<string>();

  for (const row of rows) {
    const expiryDate = fromDbDate(row.expiryDate)!;
    const { status, daysLeft } = getCredentialStatus(expiryDate, today, settings);
    const threshold = thresholds.find((t) => daysLeft! <= t);
    if (threshold === undefined || (status !== 'RED' && status !== 'YELLOW')) continue;
    const key = `exp:${row.id}:${expiryDate}:${threshold}`;
    userKeys.add(key);
    const phrase = expiryPhrase(row.credential.name, daysLeft!);
    const body = `Действительно до ${formatDateRu(expiryDate)}.`;

    candidates.push({
      userId: row.userId,
      kind: 'EXPIRY',
      level: status,
      title: phrase,
      body: `${body} Обновите данные удостоверения.`,
      link: '/user/credentials',
      dedupKey: key,
    });
    for (const admin of admins) {
      candidates.push({
        userId: admin.id,
        kind: 'EXPIRY',
        level: status,
        title: `${row.user.fullName}: ${phrase}`,
        body,
        link: `/admin/users/${row.userId}`,
        dedupKey: `${key}:a${admin.id}`,
      });
    }
    const entry = emailLines.get(row.userId) ?? { email: row.user.email, fullName: row.user.fullName, lines: [] };
    entry.lines.push({ credential: row.credential.name, expiryDate: formatDateRu(expiryDate), status, daysText: daysLeftText(daysLeft), key });
    emailLines.set(row.userId, entry);
  }
  if (candidates.length === 0) return 0;

  // Какие из уведомлений действительно новые — для подсчёта и писем
  const existing = await prisma.notification.findMany({
    where: { dedupKey: { in: candidates.map((c) => c.dedupKey) } },
    select: { dedupKey: true },
  });
  const seen = new Set(existing.map((e) => e.dedupKey));
  const fresh = candidates.filter((c) => !seen.has(c.dedupKey));
  if (fresh.length === 0) return 0;
  await prisma.notification.createMany({ data: fresh, skipDuplicates: true });

  const freshKeys = new Set(fresh.map((c) => c.dedupKey));
  for (const { email, fullName, lines } of emailLines.values()) {
    const newLines = lines.filter((l) => freshKeys.has(l.key));
    if (!email || newLines.length === 0) continue;
    const anyRed = newLines.some((l) => l.status === 'RED');
    void sendMail(
      email,
      anyRed ? 'Срок действия удостоверения истекает или истёк' : 'Подходит срок действия удостоверения',
      expiryEmail({
        greeting: `Уважаемый(ая) ${fullName}!`,
        intro: 'У вас подходит к концу или закончился срок действия удостоверений:',
        lines: newLines,
        link: '/user/credentials',
      }),
    );
  }
  return fresh.filter((c) => userKeys.has(c.dedupKey)).length;
}

/**
 * Ежедневное письмо администраторам со списком всех красных и жёлтых удостоверений.
 * Отправляется не чаще раза в день (дата последней отправки хранится в Setting).
 */
export async function sendAdminEmailDigest() {
  if (!mailEnabled()) return 0;
  const { settings, today } = await getDateContext();
  const last = await prisma.setting.findUnique({ where: { key: 'adminDigestDate' } });
  if (last?.value === today) return 0;

  const rows = await prisma.userCredential.findMany({
    where: { ...visibleCredentialWhere, OR: [statusWhere('RED', today, settings), statusWhere('YELLOW', today, settings)] },
    include: { credential: true, user: { select: { fullName: true } } },
    orderBy: { expiryDate: 'asc' },
  });
  const emails = (await activeAdmins()).map((a) => a.email).filter((e): e is string => !!e);
  const markSent = () =>
    prisma.setting.upsert({ where: { key: 'adminDigestDate' }, update: { value: today }, create: { key: 'adminDigestDate', value: today } });
  if (rows.length === 0 || emails.length === 0) {
    await markSent();
    return 0;
  }

  const lines: ExpiryLine[] = rows.map((r) => {
    const expiryDate = fromDbDate(r.expiryDate)!;
    const { status, daysLeft } = getCredentialStatus(expiryDate, today, settings);
    return {
      fullName: r.user.fullName,
      credential: r.credential.name,
      expiryDate: formatDateRu(expiryDate),
      status: status as 'RED' | 'YELLOW',
      daysText: daysLeftText(daysLeft),
    };
  });
  const red = lines.filter((l) => l.status === 'RED').length;
  // Дату отправки фиксируем только при успехе — иначе повторим при следующей проверке
  const sent = await sendMail(
    emails,
    `Сроки удостоверений: критичных ${red}, требуют внимания ${lines.length - red}`,
    expiryEmail({
      greeting: 'Добрый день!',
      intro: 'Удостоверения сотрудников, у которых подходит к концу или истёк срок действия:',
      lines,
      link: '/admin/credentials?status=RED',
    }),
  );
  if (!sent) return 0;
  await markSent();
  return emails.length;
}

// ---------- Центр уведомлений ----------

export async function list(
  userId: number,
  query: { page: number; pageSize: number; kind?: 'MESSAGE' | 'EXPIRY' },
): Promise<Paginated<NotificationDto>> {
  const where: Prisma.NotificationWhereInput = {
    userId,
    dismissedAt: null,
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

export const unreadCount = (userId: number) =>
  prisma.notification.count({ where: { userId, readAt: null, dismissedAt: null } });

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

/** Убрать из списка все прочитанные. Записи остаются — статистика прочтений сообщений не теряется. */
export async function dismissRead(userId: number) {
  const result = await prisma.notification.updateMany({
    where: { userId, readAt: { not: null }, dismissedAt: null },
    data: { dismissedAt: new Date() },
  });
  return result.count;
}
