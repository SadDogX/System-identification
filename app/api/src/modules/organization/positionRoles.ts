import type { Tx } from '../../core/db.ts';
import { conflict } from '../../core/errors.ts';
import type { SystemRoleCode } from '@app/shared';

/** Synchronizes only grants owned by a job position, preserving unrelated grants. */
export async function syncPositionSystemRole(tx: Tx, userId: number, systemRoleId: number, actorId: number) {
  const role = await tx.systemRole.findUnique({ where: { id: systemRoleId } });
  if (!role?.isActive) throw conflict('The selected position has no active system role');
  const current = await tx.userSystemRole.findMany({
    where: { userId, revokedAt: null, systemRole: { code: { not: 'ADMIN' } } },
    include: { systemRole: { select: { id: true, code: true } } },
  });
  const keep = current.find((grant) => grant.systemRoleId === systemRoleId);
  for (const grant of current) {
    if (grant.id !== keep?.id) await tx.userSystemRole.update({ where: { id: grant.id }, data: { currentUserRoleKey: null, revokedAt: new Date() } });
  }
  if (!keep) {
    await tx.userSystemRole.create({ data: { userId, systemRoleId, currentUserRoleKey: `${userId}:${systemRoleId}`, assignedById: actorId } });
  }
  return role.code as SystemRoleCode;
}
