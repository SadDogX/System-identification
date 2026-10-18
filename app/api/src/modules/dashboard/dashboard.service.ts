import type { User } from '@prisma/client';
import { CREDENTIAL_STATUSES, type DashboardDto } from '@app/shared';
import { prisma } from '../../core/db.ts';
import { fromDbDate } from '../../core/dates.ts';
import { toUserCredentialDto } from '../../core/mappers.ts';
import { statusWhere, visibleCredentialWhere } from '../credentials/filters.ts';
import { getDateContext } from '../../core/settings.ts';
import { recent } from '../audit/auditLog.service.ts';
import { unreadCount } from '../notifications/notifications.service.ts';

export async function getDashboard(admin: User): Promise<DashboardDto> {
  const { settings, today } = await getDateContext();
  const red = statusWhere('RED', today, settings);
  const yellow = statusWhere('YELLOW', today, settings);

  const [totalUsers, statusCounts, upcomingRows, criticalGroups, recentChanges, unread] = await Promise.all([
    prisma.user.count({ where: { role: 'USER', isDeleted: false } }),
    Promise.all(
      CREDENTIAL_STATUSES.map((s) =>
        prisma.userCredential.count({ where: { ...visibleCredentialWhere, ...statusWhere(s, today, settings) } }),
      ),
    ),
    // Ближайшие истечения: красные и жёлтые, начиная с самых срочных
    prisma.userCredential.findMany({
      where: { ...visibleCredentialWhere, OR: [red, yellow] },
      include: { credential: true, user: { select: { id: true, fullName: true, login: true } } },
      orderBy: { expiryDate: 'asc' },
      take: 10,
    }),
    prisma.userCredential.groupBy({
      by: ['userId'],
      where: { ...visibleCredentialWhere, ...red },
      _count: { _all: true },
      _min: { expiryDate: true },
      orderBy: { _min: { expiryDate: 'asc' } },
      take: 10,
    }),
    recent(8),
    unreadCount(admin.id),
  ]);

  const criticalUsers = await prisma.user.findMany({
    where: { id: { in: criticalGroups.map((g) => g.userId) } },
    select: { id: true, fullName: true },
  });

  return {
    totalUsers,
    counts: Object.fromEntries(CREDENTIAL_STATUSES.map((s, i) => [s, statusCounts[i]])) as DashboardDto['counts'],
    upcoming: upcomingRows.map((r) => toUserCredentialDto(r, today, settings)),
    criticalUsers: criticalGroups.map((g) => ({
      id: g.userId,
      fullName: criticalUsers.find((u) => u.id === g.userId)?.fullName ?? '—',
      redCount: g._count._all,
      nearestExpiry: fromDbDate(g._min.expiryDate),
    })),
    recentChanges,
    unreadNotifications: unread,
  };
}
