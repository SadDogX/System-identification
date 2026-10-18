import type { Prisma, User } from '@prisma/client';
import {
  addMonths,
  type AdminCredentialUpdateRequest,
  type CredentialStatus,
  type Paginated,
  type UserCredentialDto,
} from '@app/shared';
import { prisma, type Tx } from '../../core/db.ts';
import { badRequest, notFound } from '../../core/errors.ts';
import { toDbDate } from '../../core/dates.ts';
import { toUserCredentialDto } from '../../core/mappers.ts';
import { audit, diffOf } from '../../core/audit.ts';
import { getDateContext } from '../../core/settings.ts';
import { checkExpiryNotifications } from '../notifications/notifications.service.ts';
import { statusWhere, visibleCredentialWhere } from './filters.ts';
import { deletePhotoFile } from './photos.service.ts';

const AUDIT_FIELDS = ['number', 'issueDate', 'expiryDate', 'comment', 'isMarkedForDeletion'] as const;

const withRelations = {
  credential: true,
  user: { select: { id: true, fullName: true, login: true } },
} satisfies Prisma.UserCredentialInclude;

/** Создаёт сотруднику пустые записи по всем действующим позициям справочника. */
export async function ensureUserCredentials(tx: Tx, userId: number) {
  const items = await tx.credential.findMany({ where: { isArchived: false }, select: { id: true } });
  if (items.length === 0) return;
  await tx.userCredential.createMany({
    data: items.map((item) => ({ userId, credentialId: item.id })),
    skipDuplicates: true,
  });
}

/** Создаёт пустую запись позиции справочника всем сотрудникам. */
export async function backfillCatalogItem(tx: Tx, credentialId: number) {
  const users = await tx.user.findMany({ where: { role: 'USER', isDeleted: false }, select: { id: true } });
  if (users.length === 0) return;
  await tx.userCredential.createMany({
    data: users.map((u) => ({ userId: u.id, credentialId })),
    skipDuplicates: true,
  });
}

function assertIssueDate(issueDate: string, today: string) {
  if (issueDate > today) {
    throw badRequest('Ошибка валидации', { issueDate: 'Дата выдачи не может быть в будущем' });
  }
}

const orderBy: Prisma.UserCredentialOrderByWithRelationInput[] = [
  { credential: { sortOrder: 'asc' } },
  { credential: { name: 'asc' } },
];

// ---------- Сотрудник ----------

export async function listOwn(userId: number): Promise<UserCredentialDto[]> {
  const { settings, today } = await getDateContext();
  const rows = await prisma.userCredential.findMany({
    where: { userId, isMarkedForDeletion: false, credential: { isArchived: false } },
    include: { credential: true },
    orderBy,
  });
  return rows.map((r) => toUserCredentialDto(r, today, settings));
}

/** Сотрудник вводит только дату выдачи; дату окончания считает сервер по сроку из справочника. */
export async function updateOwn(user: User, id: number, issueDate: string): Promise<UserCredentialDto> {
  const { settings, today } = await getDateContext();
  // Чужая, помеченная или архивная запись для сотрудника «не существует»
  const existing = await prisma.userCredential.findFirst({
    where: { id, userId: user.id, isMarkedForDeletion: false, credential: { isArchived: false } },
    include: { credential: true },
  });
  if (!existing) throw notFound('Удостоверение не найдено');
  assertIssueDate(issueDate, today);

  const data = {
    issueDate: toDbDate(issueDate),
    expiryDate: toDbDate(addMonths(issueDate, existing.credential.validityMonths)),
  };
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.userCredential.update({
      where: { id },
      data: { ...data, updatedById: user.id },
      include: { credential: true },
    });
    await audit(tx, {
      actorId: user.id,
      action: 'credential.update',
      entityType: 'UserCredential',
      entityId: id,
      targetUserId: user.id,
      diff: diffOf(existing, data, [...AUDIT_FIELDS]),
    });
    return row;
  });
  await checkExpiryNotifications({ userCredentialId: id });
  return toUserCredentialDto(updated, today, settings);
}

/** Сотрудник очищает данные своего удостоверения: даты, номер и фото. Запись остаётся «не заполнено». */
export async function clearOwn(user: User, id: number): Promise<UserCredentialDto> {
  const { settings, today } = await getDateContext();
  const existing = await prisma.userCredential.findFirst({
    where: { id, userId: user.id, isMarkedForDeletion: false, credential: { isArchived: false } },
  });
  if (!existing) throw notFound('Удостоверение не найдено');

  const data = { number: null, issueDate: null, expiryDate: null, photoFile: null, photoMime: null };
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.userCredential.update({
      where: { id },
      data: { ...data, updatedById: user.id },
      include: { credential: true },
    });
    await audit(tx, {
      actorId: user.id,
      action: 'credential.clear',
      entityType: 'UserCredential',
      entityId: id,
      targetUserId: user.id,
      diff: diffOf(existing, data, [...AUDIT_FIELDS]),
    });
    return row;
  });
  await deletePhotoFile(existing.photoFile);
  return toUserCredentialDto(updated, today, settings);
}

// ---------- Администратор ----------

interface AdminListQuery {
  q?: string;
  status?: CredentialStatus;
  credentialId?: number;
  userId?: number;
  marked?: boolean;
  page: number;
  pageSize: number;
}

export async function adminList(query: AdminListQuery): Promise<Paginated<UserCredentialDto>> {
  const { settings, today } = await getDateContext();
  const where: Prisma.UserCredentialWhereInput = {
    ...visibleCredentialWhere,
    isMarkedForDeletion: query.marked ?? false,
    ...(query.credentialId && { credentialId: query.credentialId }),
    ...(query.userId && { userId: query.userId }),
    AND: [
      query.status ? statusWhere(query.status, today, settings) : {},
      query.q
        ? {
            OR: [
              { number: { contains: query.q } },
              { credential: { name: { contains: query.q } } },
              { user: { fullName: { contains: query.q } } },
              { user: { login: { contains: query.q } } },
            ],
          }
        : {},
    ],
  };
  const [rows, total] = await Promise.all([
    prisma.userCredential.findMany({
      where,
      include: withRelations,
      // Сначала ближайшие истечения, незаполненные — в конце
      orderBy: [{ expiryDate: { sort: 'asc', nulls: 'last' } }, { user: { fullName: 'asc' } }, ...orderBy],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.userCredential.count({ where }),
  ]);
  return {
    items: rows.map((r) => toUserCredentialDto(r, today, settings)),
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
}

/** Все записи сотрудника для карточки пользователя у администратора (включая помеченные). */
export async function adminListForUser(userId: number): Promise<UserCredentialDto[]> {
  const { settings, today } = await getDateContext();
  const rows = await prisma.userCredential.findMany({
    where: { userId, credential: { isArchived: false } },
    include: withRelations,
    orderBy: [{ isMarkedForDeletion: 'asc' }, ...orderBy],
  });
  return rows.map((r) => toUserCredentialDto(r, today, settings));
}

async function findForAdmin(id: number) {
  const row = await prisma.userCredential.findFirst({
    where: { id, user: { isDeleted: false } },
    include: withRelations,
  });
  if (!row) throw notFound('Удостоверение не найдено');
  return row;
}

async function applyAdminChange(
  actor: User,
  id: number,
  action: string,
  data: Prisma.UserCredentialUncheckedUpdateInput & Record<string, unknown>,
): Promise<UserCredentialDto> {
  const existing = await findForAdmin(id);
  const { settings, today } = await getDateContext();
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.userCredential.update({
      where: { id },
      data: { ...data, updatedById: actor.id },
      include: withRelations,
    });
    await audit(tx, {
      actorId: actor.id,
      action,
      entityType: 'UserCredential',
      entityId: id,
      targetUserId: existing.userId,
      diff: diffOf(existing, data, [...AUDIT_FIELDS]),
    });
    return row;
  });
  await checkExpiryNotifications({ userCredentialId: id });
  return toUserCredentialDto(updated, today, settings);
}

export async function adminUpdate(actor: User, id: number, input: AdminCredentialUpdateRequest) {
  const existing = await findForAdmin(id);
  const data: Record<string, unknown> = {};
  if (input.number !== undefined) data.number = input.number;
  if (input.comment !== undefined) data.comment = input.comment;
  if (input.issueDate !== undefined) {
    const { today } = await getDateContext();
    assertIssueDate(input.issueDate, today);
    data.issueDate = toDbDate(input.issueDate);
    data.expiryDate = toDbDate(addMonths(input.issueDate, existing.credential.validityMonths));
  }
  return applyAdminChange(actor, id, 'credential.update', data);
}

/** Очистка данных: запись и позиция справочника остаются, у сотрудника снова «не заполнено». */
export async function adminClear(actor: User, id: number) {
  const before = await findForAdmin(id);
  const result = await applyAdminChange(actor, id, 'credential.clear', {
    number: null,
    issueDate: null,
    expiryDate: null,
    comment: null,
    photoFile: null,
    photoMime: null,
  });
  await deletePhotoFile(before.photoFile);
  return result;
}

export const adminMark = (actor: User, id: number) =>
  applyAdminChange(actor, id, 'credential.mark', { isMarkedForDeletion: true });

export const adminUnmark = (actor: User, id: number) =>
  applyAdminChange(actor, id, 'credential.unmark', { isMarkedForDeletion: false });
