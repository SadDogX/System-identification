import type { Credential, User, UserCredential } from '@prisma/client';
import {
  getCredentialStatus,
  parse,
  uiSettingsSchema,
  type StatusThresholds,
  type UserCredentialDto,
  type UserDto,
} from '@app/shared';
import { fromDbDate } from './dates.ts';
import type { UserWithPosition } from './db.ts';

/** Пароль и служебные поля в ответ API не попадают. */
export function toUserDto(user: UserWithPosition): UserDto {
  const ui = parse(uiSettingsSchema, user.uiSettings ?? {});
  return {
    id: user.id,
    fullName: user.fullName,
    login: user.login,
    role: user.role,
    positionId: user.positionId,
    position: user.position?.name ?? null,
    phone: user.phone,
    email: user.email,
    photoMime: user.photoFile ? user.photoMime : null,
    photoFile: user.photoFile,
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword,
    uiSettings: ui.ok ? ui.value : {},
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
    photoMime: row.photoFile ? row.photoMime : null,
    status,
    daysLeft,
    updatedAt: row.updatedAt.toISOString(),
    user: row.user ? { id: row.user.id, fullName: row.user.fullName, login: row.user.login } : undefined,
  };
}
