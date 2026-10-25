import type { Role, UiSettings, WorkDayStatus } from './schemas.ts';
import type { CredentialStatus, StatusThresholds } from './status.ts';

export interface Paginated<T> { items: T[]; total: number; page: number; pageSize: number }
export interface UserDto { id: number; fullName: string; login: string; role: Role; positionId: number | null; position: string | null; phone: string | null; email: string | null; photoMime: string | null; photoFile: string | null; isActive: boolean; mustChangePassword: boolean; uiSettings: UiSettings; createdAt: string }
export interface UserListItemDto extends UserDto { counts: Record<CredentialStatus, number> & { total: number } }
export interface AuthResponse { accessToken: string; user: UserDto; settings: AppSettingsDto }
export interface AppSettingsDto extends StatusThresholds { timezone: string }
export interface CatalogItemDto { id: number; name: string; validityMonths: number; sortOrder: number; isArchived: boolean }
export interface PositionDto { id: number; name: string; sortOrder: number; isArchived: boolean; usersCount: number }
export interface UserCredentialDto { id: number; userId: number; credentialId: number; name: string; validityMonths: number; number: string | null; issueDate: string | null; expiryDate: string | null; comment: string | null; isMarkedForDeletion: boolean; photoMime: string | null; status: CredentialStatus; daysLeft: number | null; updatedAt: string; user?: { id: number; fullName: string; login: string } }
export type NotificationKind = 'EXPIRY' | 'MESSAGE' | 'DIGEST';
export interface NotificationDto { id: number; kind: NotificationKind; level: CredentialStatus | null; title: string; body: string; link: string | null; readAt: string | null; createdAt: string }
export interface MessageDto { id: number; subject: string; body: string; isBroadcast: boolean; createdAt: string; sender: { id: number; fullName: string }; recipientsCount: number; readCount: number; recipient: { id: number; fullName: string } | null }
export interface ScheduleTemplateDto { id: number; userId: number; name: string; workDays: number; restDays: number; cycleStart: string; validFrom: string; validTo: string | null; isActive: boolean; version: number; user?: { id: number; fullName: string } }
export interface SchedulePeriodDto { id: number; userId: number; type: 'WORK' | 'REST' | 'VACATION' | 'SICK_LEAVE' | 'ABSENCE' | 'UNDETERMINED'; status: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'; startDate: string; endDate: string; note: string | null; user?: { id: number; fullName: string } }
export interface WorkScheduleEntryDto { id: number; userId: number; date: string; status: WorkDayStatus }
export interface WorkScheduleDto { userId: number; year: number; entries: WorkScheduleEntryDto[]; stats: Record<WorkDayStatus, number> }
export interface WorkScheduleAnnualRowDto { user: { id: number; fullName: string }; entries: WorkScheduleEntryDto[] }
export interface WorkScheduleAnnualDto { year: number; rows: WorkScheduleAnnualRowDto[] }

export interface RadarCardDto { id: number; userId: number; customerName: string; mainInfo: string; event: string; actionsTaken: string; incidentDate: string; requiredActions: string | null; stoppedWork: boolean; createdAt: string; updatedAt: string; user?: { id: number; fullName: string; login: string } }
export interface IfoProposalDto { id: number; proposerId: number; title: string; problem: string; proposal: string; expectedBenefit: string; createdAt: string; updatedAt: string; proposer?: { id: number; fullName: string; login: string } }
export interface AuditLogDto { id: number; action: string; entityType: string; entityId: number | null; diff: Record<string, { from: unknown; to: unknown }> | null; createdAt: string; actor: { id: number; fullName: string } | null; targetUser: { id: number; fullName: string } | null }
export interface DashboardDto { totalUsers: number; counts: Record<CredentialStatus, number>; upcoming: UserCredentialDto[]; criticalUsers: { id: number; fullName: string; redCount: number; nearestExpiry: string | null }[]; recentChanges: AuditLogDto[]; unreadNotifications: number }
export interface OverviewDto { credentials: { id: number; name: string }[]; rows: { user: { id: number; fullName: string; position: string | null }; cells: Record<number, { id: number; status: CredentialStatus; expiryDate: string | null; daysLeft: number | null; marked: boolean }> }[] }
export interface ApiErrorBody { error: string; details?: Record<string, string> }
