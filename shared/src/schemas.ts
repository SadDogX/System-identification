import { isIsoDate } from './dates.ts';
import { CREDENTIAL_STATUSES } from './status.ts';
import {
  bool,
  int,
  matches,
  object,
  oneOf,
  optional,
  optionalId,
  optionalText,
  queryBool,
  rawText,
  text,
  type Infer,
} from './validation.ts';

export const ROLES = ['ADMIN', 'USER'] as const;
export type Role = (typeof ROLES)[number];

export const isoDate = matches(
  (v): v is string => typeof v === 'string' && isIsoDate(v),
  'Укажите корректную дату',
);

const passwordSchema = rawText({ min: 8, max: 100, message: 'Пароль должен содержать не менее 8 символов' });

const loginField = text({
  min: 3,
  max: 50,
  message: 'Логин должен содержать не менее 3 символов',
  pattern: [/^[a-zA-Z0-9._-]+$/, 'Логин может содержать только латинские буквы, цифры и . _ -'],
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const optionalEmail = optionalText(150, [(v) => EMAIL_RE.test(v), 'Некорректный email']);

// ---------- Авторизация ----------

export const loginRequestSchema = object({
  login: text({ max: 50, message: 'Введите логин' }),
  password: rawText({ min: 1, max: 100, message: 'Введите пароль' }),
});
export type LoginRequest = Infer<typeof loginRequestSchema>;

export const changePasswordSchema = object({
  currentPassword: rawText({ min: 1, max: 100, message: 'Введите текущий пароль' }),
  newPassword: passwordSchema,
});
export type ChangePasswordRequest = Infer<typeof changePasswordSchema>;

// ---------- Пользователи ----------

export const createUserSchema = object({
  fullName: text({ max: 200, message: 'Укажите ФИО' }),
  login: loginField,
  password: passwordSchema,
  role: oneOf(ROLES),
  positionId: optionalId(),
  phone: optionalText(50),
  email: optionalEmail,
});
export type CreateUserRequest = Infer<typeof createUserSchema>;

export const updateUserSchema = object({
  fullName: optional(text({ max: 200, message: 'Укажите ФИО' })),
  role: optional(oneOf(ROLES)),
  isActive: optional(bool()),
  positionId: optionalId(),
  phone: optionalText(50),
  email: optionalEmail,
});
export type UpdateUserRequest = Infer<typeof updateUserSchema>;

export const resetPasswordSchema = object({ password: passwordSchema });

/** Поля профиля, которые пользователь может менять сам. */
export const updateProfileSchema = object({
  phone: optionalText(50),
  email: optionalEmail,
});
export type UpdateProfileRequest = Infer<typeof updateProfileSchema>;

export const VIEW_MODES = ['table', 'cards'] as const;
export type ViewMode = (typeof VIEW_MODES)[number];

export const uiSettingsSchema = object({
  credentialsView: optional(oneOf(VIEW_MODES)),
});
export type UiSettings = Infer<typeof uiSettingsSchema>;

export const USER_LIST_FILTERS = ['all', 'USER', 'ADMIN', 'hasRed', 'hasYellow', 'hasWhite'] as const;

export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const;
export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;

const page = int({ min: 1, default: 1 });
const pageSize = (def: number, max: number) => int({ min: 1, max, default: def });
const optionalQueryText = optionalText(200);

export const userListQuerySchema = object({
  q: optionalQueryText,
  positionId: optional(int()),
  filter: optional(oneOf(USER_LIST_FILTERS)),
  page,
  pageSize: pageSize(20, 100),
});

// ---------- Справочник удостоверений ----------

export const catalogItemSchema = object({
  name: text({ max: 200, message: 'Укажите название' }),
  validityMonths: int({ min: 1, max: 600, message: 'Срок — целое число месяцев от 1 до 600' }),
  sortOrder: int({ min: 0, default: 0 }),
});
export type CatalogItemRequest = Infer<typeof catalogItemSchema>;

export const positionSchema = object({
  name: text({ max: 150, message: 'Укажите название должности' }),
  sortOrder: int({ min: 0, default: 0 }),
});
export type PositionRequest = Infer<typeof positionSchema>;

// ---------- Удостоверения ----------

/** Сотрудник вводит только дату выдачи, дата окончания считается автоматически. */
export const userCredentialUpdateSchema = object({ issueDate: isoDate });

export const adminCredentialUpdateSchema = object({
  issueDate: optional(isoDate),
  number: optionalText(100),
  comment: optionalText(1000),
});
export type AdminCredentialUpdateRequest = Infer<typeof adminCredentialUpdateSchema>;

export const credentialListQuerySchema = object({
  q: optionalQueryText,
  status: optional(oneOf(CREDENTIAL_STATUSES)),
  credentialId: optional(int()),
  userId: optional(int()),
  marked: queryBool(),
  page,
  pageSize: pageSize(50, 200),
});

// ---------- Сообщения ----------

export const sendMessageSchema = object(
  {
    recipient: oneOf(['user', 'all'] as const),
    userId: optional(int()),
    subject: text({ max: 200, message: 'Укажите тему' }),
    body: text({ max: 5000, message: 'Введите текст сообщения' }),
  },
  (v) => (v.recipient === 'user' && v.userId === undefined ? ['userId', 'Выберите получателя'] : null),
);
export type SendMessageRequest = Infer<typeof sendMessageSchema>;

export const overviewQuerySchema = object({
  q: optionalQueryText,
  positionId: optional(int()),
});

// ---------- Списки ----------

export const notificationsQuerySchema = object({
  kind: optional(oneOf(['MESSAGE', 'EXPIRY'] as const)),
  page,
  pageSize: pageSize(30, 100),
});

export const auditListQuerySchema = object({
  entityType: optional(oneOf(['User', 'UserCredential', 'Credential', 'Position', 'Message'] as const)),
  targetUserId: optional(int()),
  page,
  pageSize: pageSize(30, 100),
});

export const paginationQuerySchema = object({ page, pageSize: pageSize(30, 100) });
