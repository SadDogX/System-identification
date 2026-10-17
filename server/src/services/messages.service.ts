import type { User } from '@prisma/client';
import type { MessageDto, Paginated, SendMessageRequest } from '@app/shared';
import { prisma } from '../db.ts';
import { badRequest } from '../utils/errors.ts';
import { audit } from './audit.service.ts';

/**
 * Сообщение сохраняется один раз, а каждому получателю создаётся запись в центре
 * уведомлений со своим статусом «прочитано». Broadcast получают все активные
 * сотрудники на момент отправки.
 */
export async function send(actor: User & { fullName: string }, input: SendMessageRequest) {
  const recipients = await prisma.user.findMany({
    where:
      input.recipient === 'all'
        ? { role: 'USER', isActive: true, isDeleted: false }
        : { id: input.userId, isActive: true, isDeleted: false },
    select: { id: true, fullName: true },
  });
  if (recipients.length === 0) {
    throw badRequest('Ошибка валидации', {
      userId: input.recipient === 'all' ? 'Нет активных пользователей' : 'Получатель не найден',
    });
  }
  const isBroadcast = input.recipient === 'all';

  return prisma.$transaction(async (tx) => {
    const message = await tx.message.create({
      data: { senderId: actor.id, subject: input.subject, body: input.body, isBroadcast },
    });
    await tx.notification.createMany({
      data: recipients.map((r) => ({
        userId: r.id,
        kind: 'MESSAGE' as const,
        title: `Сообщение от администратора: ${input.subject}`,
        body: input.body,
        messageId: message.id,
      })),
    });
    // Остальные администраторы видят все отправленные сообщения у себя в уведомлениях.
    // messageId не ставим — иначе копии попадут в статистику «прочитали X из Y».
    const otherAdmins = await tx.user.findMany({
      where: { role: 'ADMIN', isDeleted: false, isActive: true, id: { notIn: [actor.id, ...recipients.map((r) => r.id)] } },
      select: { id: true },
    });
    if (otherAdmins.length > 0) {
      const to = isBroadcast ? 'всем сотрудникам' : recipients[0].fullName;
      await tx.notification.createMany({
        data: otherAdmins.map((a) => ({
          userId: a.id,
          kind: 'MESSAGE' as const,
          title: `${actor.fullName} → ${to}: ${input.subject}`,
          body: input.body,
          link: '/admin/messages',
        })),
      });
    }
    await audit(tx, {
      actorId: actor.id,
      action: 'message.send',
      entityType: 'Message',
      entityId: message.id,
      targetUserId: isBroadcast ? null : recipients[0].id,
      diff: {
        subject: { from: null, to: input.subject },
        recipient: {
          from: null,
          to: isBroadcast ? `Все пользователи (${recipients.length})` : recipients[0].fullName,
        },
      },
    });
    return { id: message.id, recipientsCount: recipients.length };
  });
}

export async function history(query: { page: number; pageSize: number }): Promise<Paginated<MessageDto>> {
  const [rows, total] = await Promise.all([
    prisma.message.findMany({
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: { sender: { select: { id: true, fullName: true } } },
    }),
    prisma.message.count(),
  ]);
  const ids = rows.map((r) => r.id);
  const [all, read, personal] = await Promise.all([
    prisma.notification.groupBy({ by: ['messageId'], where: { messageId: { in: ids } }, _count: { _all: true } }),
    prisma.notification.groupBy({
      by: ['messageId'],
      where: { messageId: { in: ids }, readAt: { not: null } },
      _count: { _all: true },
    }),
    prisma.notification.findMany({
      where: { messageId: { in: rows.filter((r) => !r.isBroadcast).map((r) => r.id) } },
      select: { messageId: true, user: { select: { id: true, fullName: true } } },
    }),
  ]);
  const countOf = (groups: typeof all, id: number) => groups.find((g) => g.messageId === id)?._count._all ?? 0;

  return {
    items: rows.map((r) => ({
      id: r.id,
      subject: r.subject,
      body: r.body,
      isBroadcast: r.isBroadcast,
      createdAt: r.createdAt.toISOString(),
      sender: r.sender,
      recipientsCount: countOf(all, r.id),
      readCount: countOf(read, r.id),
      recipient: r.isBroadcast ? null : (personal.find((p) => p.messageId === r.id)?.user ?? null),
    })),
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
}
