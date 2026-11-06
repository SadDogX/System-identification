import type { Tx } from '../../core/db.ts';
import { conflict } from '../../core/errors.ts';

export type PositionSystemRole = 'MANAGER' | 'COORDINATOR' | null;

export function positionSystemRole(positionName: string | null | undefined): PositionSystemRole {
  const name = positionName?.trim().toLocaleLowerCase('ru-RU') ?? '';
  if (/^координатор(?:\s|$)/u.test(name)) return 'COORDINATOR';
  if (/^менеджер(?:\s|$)/u.test(name)) return 'MANAGER';
  return null;
}

/** Synchronizes only position-derived manager/coordinator roles, leaving other role grants untouched. */
export async function syncPositionSystemRole(
  tx: Tx,
  userId: number,
  oldPositionName: string | null | undefined,
  newPositionName: string | null | undefined,
  actorId: number,
) {
  const oldRole = positionSystemRole(oldPositionName);
  const nextRole = positionSystemRole(newPositionName);

  const current = await tx.userSystemRole.findMany({
    where: { userId, revokedAt: null, systemRole: { code: { in: ['MANAGER', 'COORDINATOR'] } } },
    include: { systemRole: { select: { code: true } } },
  });
  const revoke = nextRole
    ? current.filter((grant) => grant.systemRole.code !== nextRole)
    : oldRole ? current.filter((grant) => grant.systemRole.code === oldRole) : [];

  for (const grant of revoke) {
    await tx.userSystemRole.update({
      where: { id: grant.id },
      data: { currentUserRoleKey: null, revokedAt: new Date() },
    });
  }

  if (!nextRole || current.some((grant) => grant.systemRole.code === nextRole)) return;
  const role = await tx.systemRole.findUnique({ where: { code: nextRole } });
  if (!role?.isActive) throw conflict(`Не настроена системная роль ${nextRole}`);
  await tx.userSystemRole.create({
    data: {
      userId,
      systemRoleId: role.id,
      currentUserRoleKey: `${userId}:${role.id}`,
      assignedById: actorId,
    },
  });
}
