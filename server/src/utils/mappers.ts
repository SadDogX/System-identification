import type { Credential, User, UserCredential } from '@prisma/client';
import {
  getCredentialStatus,
  uiSettingsSchema,
  type StatusThresholds,
  type UserCredentialDto,
  type UserDto,
} from '@app/shared';
import { fromDbDate } from './dates';

/** Пароль и служебные поля в ответ API не попадают. */
export function toUserDto(user: User): UserDto {
  const ui = uiSettingsSchema.safeParse(user.uiSettings ?? {});
  return {
    id: user.id,
    fullName: user.fullName,
    login: user.login,
    role: user.role,
    position: user.position,
    phone: user.phone,
    email: user.email,
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword,
    uiSettings: ui.success ? ui.data : {},
    createdAt: user.createdAt.toISOString(),
  };
}

type CredentialRow = UserCredential & {
  credential: Credential;
  user?: Pick<User, 'id' | 'fullName' | 'login'>;
};

export function toUserCredentialDto(
  row: CredentialRow,
  today: string,
  thresholds: StatusThresholds,
): UserCredentialDto {
  const expiryDate = fromDbDate(row.expiryDate);
  const { status, daysLeft } = getCredentialStatus(expiryDate, today, thresholds);
  return {
    id: row.id,
    userId: row.userId,
    credentialId: row.credentialId,
    name: row.credential.name,
    validityMonths: row.credential.validityMonths,
    number: row.number,
    issueDate: fromDbDate(row.issueDate),
    expiryDate,
    comment: row.comment,
    isMarkedForDeletion: row.isMarkedForDeletion,
    status,
    daysLeft,
    updatedAt: row.updatedAt.toISOString(),
    user: row.user ? { id: row.user.id, fullName: row.user.fullName, login: row.user.login } : undefined,
  };
}
