import type { Prisma } from '@prisma/client';
import { expiryRangeForStatus, type CredentialStatus, type StatusThresholds } from '@app/shared';
import { toDbDate } from '../utils/dates';

/**
 * Записи, которые участвуют в списках и статистике:
 * не помечены на удаление, позиция справочника не в архиве, сотрудник не удалён.
 */
export const visibleCredentialWhere: Prisma.UserCredentialWhereInput = {
  isMarkedForDeletion: false,
  credential: { isArchived: false },
  user: { isDeleted: false, role: 'USER' },
};

/** Условие на дату окончания для статуса. Статус в БД не хранится — он зависит от текущей даты. */
export function statusWhere(
  status: CredentialStatus,
  today: string,
  thresholds: StatusThresholds,
): Prisma.UserCredentialWhereInput {
  if (status === 'WHITE') return { expiryDate: null };
  const range = expiryRangeForStatus(status, today, thresholds);
  return {
    expiryDate: {
      not: null,
      ...(range.gte && { gte: toDbDate(range.gte) }),
      ...(range.lte && { lte: toDbDate(range.lte) }),
    },
  };
}
