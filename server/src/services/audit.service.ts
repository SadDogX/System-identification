import type { Prisma } from '@prisma/client';
import type { Tx } from '../db.ts';

type Diff = Record<string, { from: unknown; to: unknown }>;

interface AuditEntry {
  actorId: number | null;
  action: string;
  entityType: string;
  entityId?: number | null;
  targetUserId?: number | null;
  diff?: Diff | null;
}

function normalize(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value ?? null;
}

/** Разница между двумя состояниями записи по указанным полям. */
export function diffOf(
  before: Record<string, unknown> | null,
  after: Record<string, unknown>,
  fields: readonly string[],
): Diff {
  const diff: Diff = {};
  for (const field of fields) {
    if (!(field in after)) continue;
    const from = normalize(before?.[field]);
    const to = normalize(after[field]);
    if (from !== to) diff[field] = { from, to };
  }
  return diff;
}

/** Пишет запись журнала. Вызывается внутри той же транзакции, что и изменение. */
export async function audit(tx: Tx, entry: AuditEntry) {
  if (entry.diff && Object.keys(entry.diff).length === 0) return;
  await tx.auditLog.create({
    data: {
      actorId: entry.actorId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      targetUserId: entry.targetUserId ?? null,
      diff: (entry.diff ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
}
