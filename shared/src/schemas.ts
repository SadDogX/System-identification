import { z } from 'zod';
import { isIsoDate } from './dates';
import { CREDENTIAL_STATUSES } from './status';

export const ROLES = ['ADMIN', 'USER'] as const;
export type Role = (typeof ROLES)[number];

const trimmed = (max: number) => z.string().trim().max(max);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional();

export const isoDate = z.string().refine(isIsoDate, 'Некорректная дата (ожидается ГГГГ-ММ-ДД)');

export const passwordSchema = z
  .string()
  .min(8, 'Пароль должен содержать не менее 8 символов')
  .max(100, 'Слишком длинный пароль');

export const loginSchema = z
  .string()
  .trim()
  .min(3, 'Логин должен содержать не менее 3 символов')
  .max(50)
  .regex(/^[a-zA-Z0-9._-]+$/, 'Логин может содержать только латинские буквы, цифры и . _ -');

// ---------- Авторизация ----------

export const loginRequestSchema = z.object({
  login: z.string().trim().min(1, 'Введите логин'),
  password: z.string().min(1, 'Введите пароль'),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Введите текущий пароль'),
  newPassword: passwordSchema,
});
export type ChangePasswordRequest = z.infer<typeof changePasswordSchema>;

// ---------- Пользователи ----------

const profileFields = {
  position: optionalText(150),
  phone: optionalText(50),
  email: z
    .string()
    .trim()
    .max(150)
    .transform((v) => (v === '' ? null : v))
    .pipe(z.string().email('Некорректный email').nullable())
    .nullable()
    .optional(),
};

export const createUserSchema = z.object({
  fullName: trimmed(200).min(1, 'Укажите ФИО'),
  login: loginSchema,
  password: passwordSchema,
  role: z.enum(ROLES),
  ...profileFields,
});
export type CreateUserRequest = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  fullName: trimmed(200).min(1, 'Укажите ФИО').optional(),
  role: z.enum(ROLES).optional(),
  isActive: z.boolean().optional(),
  ...profileFields,
});
export type UpdateUserRequest = z.infer<typeof updateUserSchema>;

export const resetPasswordSchema = z.object({ password: passwordSchema });

/** Поля профиля, которые пользователь может менять сам. */
export const updateProfileSchema = z.object({
  phone: profileFields.phone,
  email: profileFields.email,
});
export type UpdateProfileRequest = z.infer<typeof updateProfileSchema>;

export const VIEW_MODES = ['table', 'cards'] as const;
export type ViewMode = (typeof VIEW_MODES)[number];

export const uiSettingsSchema = z.object({
  credentialsView: z.enum(VIEW_MODES).optional(),
});
export type UiSettings = z.infer<typeof uiSettingsSchema>;

export const USER_LIST_FILTERS = ['all', 'USER', 'ADMIN', 'hasRed', 'hasYellow', 'hasWhite'] as const;

export const userListQuerySchema = z.object({
  q: z.string().trim().optional(),
  filter: z.enum(USER_LIST_FILTERS).default('all'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

// ---------- Справочник удостоверений ----------

export const catalogItemSchema = z.object({
  name: trimmed(200).min(1, 'Укажите название'),
  validityMonths: z.coerce
    .number({ invalid_type_error: 'Укажите срок' })
    .int('Срок — целое число месяцев')
    .min(1, 'Срок должен быть не меньше 1 месяца')
    .max(600, 'Слишком большой срок'),
  sortOrder: z.coerce.number().int().min(0).default(0),
});
export type CatalogItemRequest = z.infer<typeof catalogItemSchema>;

// ---------- Удостоверения ----------

/** Сотрудник вводит только дату выдачи, дата окончания считается автоматически. */
export const userCredentialUpdateSchema = z.object({
  issueDate: isoDate,
});
export type UserCredentialUpdateRequest = z.infer<typeof userCredentialUpdateSchema>;

export const adminCredentialUpdateSchema = z.object({
  issueDate: isoDate.optional(),
  number: optionalText(100),
  comment: optionalText(1000),
});
export type AdminCredentialUpdateRequest = z.infer<typeof adminCredentialUpdateSchema>;

export const credentialListQuerySchema = z.object({
  q: z.string().trim().optional(),
  status: z.enum(CREDENTIAL_STATUSES).optional(),
  credentialId: z.coerce.number().int().optional(),
  userId: z.coerce.number().int().optional(),
  marked: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

// ---------- Сообщения ----------

export const sendMessageSchema = z
  .object({
    recipient: z.enum(['user', 'all']),
    userId: z.number().int().optional(),
    subject: trimmed(200).min(1, 'Укажите тему'),
    body: trimmed(5000).min(1, 'Введите текст сообщения'),
  })
  .refine((v) => v.recipient === 'all' || v.userId !== undefined, {
    message: 'Выберите получателя',
    path: ['userId'],
  });
export type SendMessageRequest = z.infer<typeof sendMessageSchema>;

// ---------- Журнал ----------

export const auditListQuerySchema = z.object({
  actorId: z.coerce.number().int().optional(),
  targetUserId: z.coerce.number().int().optional(),
  entityType: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(30),
});

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(30),
});
