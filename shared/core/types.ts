import type { Role, UiSettings } from './schemas.ts';
import type { CredentialStatus, StatusThresholds } from './status.ts';

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface UserDto {
  id: number;
  fullName: string;
  login: string;
  role: Role;
  positionId: number | null;
  /** Название должности из справочника. */
  position: string | null;
  phone: string | null;
  email: string | null;
  isActive: boolean;
  mustChangePassword: boolean;
  uiSettings: UiSettings;
  createdAt: string;
}

export interface UserListItemDto extends UserDto {
  counts: Record<CredentialStatus, number> & { total: number };
}

export interface AuthResponse {
  accessToken: string;
  user: UserDto;
  settings: AppSettingsDto;
}

export interface AppSettingsDto extends StatusThresholds {
  timezone: string;
}

export interface CatalogItemDto {
  id: number;
  name: string;
  validityMonths: number;
  sortOrder: number;
  isArchived: boolean;
}

export interface PositionDto {
  id: number;
  name: string;
  sortOrder: number;
  isArchived: boolean;
  usersCount: number;
}

export interface UserCredentialDto {
  id: number;
  userId: number;
  credentialId: number;
  name: string;
  validityMonths: number;
  number: string | null;
  issueDate: string | null;
  expiryDate: string | null;
  comment: string | null;
  isMarkedForDeletion: boolean;
  /** MIME-тип загруженного фото/скана, null — не загружено. */
  photoMime: string | null;
  status: CredentialStatus;
  daysLeft: number | null;
  updatedAt: string;
  user?: { id: number; fullName: string; login: string };
}

export type NotificationKind = 'EXPIRY' | 'MESSAGE' | 'DIGEST';

export interface NotificationDto {
  id: number;
  kind: NotificationKind;
  /** Для уведомлений о сроках — статус, определяющий цвет значка. */
  level: CredentialStatus | null;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface MessageDto {
  id: number;
  subject: string;
  body: string;
  isBroadcast: boolean;
  createdAt: string;
  sender: { id: number; fullName: string };
  recipientsCount: number;
  readCount: number;
  /** Для личного сообщения — получатель. */
  recipient: { id: number; fullName: string } | null;
}

export interface AuditLogDto {
  id: number;
  action: string;
  entityType: string;
  entityId: number | null;
  diff: Record<string, { from: unknown; to: unknown }> | null;
  createdAt: string;
  actor: { id: number; fullName: string } | null;
  targetUser: { id: number; fullName: string } | null;
}

export interface DashboardDto {
  totalUsers: number;
  counts: Record<CredentialStatus, number>;
  upcoming: UserCredentialDto[];
  criticalUsers: { id: number; fullName: string; redCount: number; nearestExpiry: string | null }[];
  recentChanges: AuditLogDto[];
  unreadNotifications: number;
}

/** Сводная таблица «сотрудники × удостоверения». */
export interface OverviewDto {
  credentials: { id: number; name: string }[];
  rows: {
    user: { id: number; fullName: string; position: string | null };
    cells: Record<number, { id: number; status: CredentialStatus; expiryDate: string | null; daysLeft: number | null; marked: boolean }>;
  }[];
}

export interface ApiErrorBody {
  error: string;
  details?: Record<string, string>;
}
