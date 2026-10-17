import type { Prisma } from '@prisma/client';
import type { AuditLogDto, Paginated } from '@app/shared';
import { prisma } from '../db.ts';

const include = {
  actor: { select: { id: true, fullName: true } },
  targetUser: { select: { id: true, fullName: true } },
} satisfies Prisma.AuditLogInclude;

type Row = Prisma.AuditLogGetPayload<{ include: typeof include }>;

function toDto(row: Row): AuditLogDto {
  return {
    id: row.id,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    diff: (row.diff as AuditLogDto['diff']) ?? null,
    createdAt: row.createdAt.toISOString(),
    actor: row.actor,
    targetUser: row.targetUser,
  };
}

export async function list(query: {
  actorId?: number;
  targetUserId?: number;
  entityType?: string;
  page: number;
  pageSize: number;
}): Promise<Paginated<AuditLogDto>> {
  const where: Prisma.AuditLogWhereInput = {
    ...(query.actorId && { actorId: query.actorId }),
    ...(query.targetUserId && { targetUserId: query.targetUserId }),
    ...(query.entityType && { entityType: query.entityType }),
  };
  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include,
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.auditLog.count({ where }),
  ]);
  return { items: rows.map(toDto), total, page: query.page, pageSize: query.pageSize };
}

export async function recent(take: number) {
  const rows = await prisma.auditLog.findMany({ include, orderBy: { createdAt: 'desc' }, take });
  return rows.map(toDto);
}
