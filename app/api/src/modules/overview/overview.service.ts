import { getCredentialStatus, type OverviewDto } from '@app/shared';
import { prisma } from '../../core/db.ts';
import { fromDbDate } from '../../core/dates.ts';
import { getDateContext } from '../../core/settings.ts';
import type { User } from '@prisma/client';
import { manageableUserIds } from '../../core/organizationAccess.ts';

/** Сводная таблица: строки — сотрудники, столбцы — удостоверения справочника, в ячейках дата окончания и статус. */
export async function getOverview(actor: User, query: { q?: string; positionId?: number }): Promise<OverviewDto> {
  const { settings, today } = await getDateContext();
  const userIds = await manageableUserIds(actor);
  const [credentials, users] = await Promise.all([
    prisma.credential.findMany({
      where: { isArchived: false },
      select: { id: true, name: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    }),
    prisma.user.findMany({
      where: {
        role: 'USER',
        isDeleted: false,
        ...(userIds.length && { id: { in: userIds } }),
        ...(query.q && { fullName: { contains: query.q } }),
        ...(query.positionId && { positionId: query.positionId }),
      },
      select: {
        id: true,
        fullName: true,
        position: { select: { name: true } },
        credentials: {
          where: { credential: { isArchived: false } },
          select: { id: true, credentialId: true, expiryDate: true, isMarkedForDeletion: true },
        },
      },
      orderBy: { fullName: 'asc' },
    }),
  ]);

  return {
    credentials,
    rows: users.map((u) => ({
      user: { id: u.id, fullName: u.fullName, position: u.position?.name ?? null },
      cells: Object.fromEntries(
        u.credentials.map((c) => {
          const expiryDate = fromDbDate(c.expiryDate);
          const { status, daysLeft } = getCredentialStatus(expiryDate, today, settings);
          return [c.credentialId, { id: c.id, status, expiryDate, daysLeft, marked: c.isMarkedForDeletion }];
        }),
      ),
    })),
  };
}
