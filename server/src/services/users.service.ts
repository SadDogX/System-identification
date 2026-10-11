import type { Prisma, User } from '@prisma/client';
import {
  CREDENTIAL_STATUSES,
  type CreateUserRequest,
  type CredentialStatus,
  type Paginated,
  type UiSettings,
  type UpdateProfileRequest,
  type UpdateUserRequest,
  type UserListItemDto,
  USER_LIST_FILTERS,
} from '@app/shared';
import { prisma } from '../db';
import { badRequest, conflict, notFound } from '../utils/errors';
import { toUserDto } from '../utils/mappers';
import { audit, diffOf } from './audit.service';
import { hashPassword } from './auth.service';
import { ensureUserCredentials } from './credentials.service';
import { statusWhere, visibleCredentialWhere } from './credentialFilters';
import { getDateContext } from './settings.service';

const PROFILE_FIELDS = ['fullName', 'role', 'position', 'phone', 'email', 'isActive'] as const;

async function findActiveUser(id: number): Promise<User> {
  const user = await prisma.user.findFirst({ where: { id, isDeleted: false } });
  if (!user) throw notFound('Пользователь не найден');
  return user;
}

async function assertNotLastAdmin(userId: number) {
  const otherAdmins = await prisma.user.count({
    where: { role: 'ADMIN', isDeleted: false, isActive: true, id: { not: userId } },
  });
  if (otherAdmins === 0) throw badRequest('Нельзя убрать последнего активного администратора');
}

// ---------- Список ----------

interface ListQuery {
  q?: string;
  filter: (typeof USER_LIST_FILTERS)[number];
  page: number;
  pageSize: number;
}

export async function list(query: ListQuery): Promise<Paginated<UserListItemDto>> {
  const { settings, today } = await getDateContext();
  const hasStatus = (status: CredentialStatus): Prisma.UserWhereInput => ({
    credentials: {
      some: {
        isMarkedForDeletion: false,
        credential: { isArchived: false },
        ...statusWhere(status, today, settings),
      },
    },
  });
  const filterWhere: Record<ListQuery['filter'], Prisma.UserWhereInput> = {
    all: {},
    USER: { role: 'USER' },
    ADMIN: { role: 'ADMIN' },
    hasRed: hasStatus('RED'),
    hasYellow: hasStatus('YELLOW'),
    hasWhite: hasStatus('WHITE'),
  };
  const where: Prisma.UserWhereInput = {
    isDeleted: false,
    ...filterWhere[query.filter],
    ...(query.q && { OR: [{ fullName: { contains: query.q } }, { login: { contains: query.q } }] }),
  };

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { fullName: 'asc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.user.count({ where }),
  ]);

  // Количество записей по статусам для пользователей на странице — по запросу на статус
  const ids = users.map((u) => u.id);
  const counts = new Map<number, UserListItemDto['counts']>(
    ids.map((id) => [id, { GREEN: 0, YELLOW: 0, RED: 0, WHITE: 0, total: 0 }]),
  );
  if (ids.length > 0) {
    await Promise.all(
      CREDENTIAL_STATUSES.map(async (status) => {
        const groups = await prisma.userCredential.groupBy({
          by: ['userId'],
          where: { ...visibleCredentialWhere, userId: { in: ids }, ...statusWhere(status, today, settings) },
          _count: { _all: true },
        });
        for (const g of groups) {
          const c = counts.get(g.userId)!;
          c[status] = g._count._all;
          c.total += g._count._all;
        }
      }),
    );
  }

  return {
    items: users.map((u) => ({ ...toUserDto(u), counts: counts.get(u.id)! })),
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
}

/** Короткий список для выбора получателя сообщения. */
export async function listOptions() {
  return prisma.user.findMany({
    where: { isDeleted: false, isActive: true, role: 'USER' },
    select: { id: true, fullName: true, login: true },
    orderBy: { fullName: 'asc' },
  });
}

export async function getById(id: number) {
  return toUserDto(await findActiveUser(id));
}

// ---------- Изменение ----------

export async function create(actor: User, input: CreateUserRequest) {
  if (await prisma.user.findUnique({ where: { login: input.login } })) {
    throw conflict('Пользователь с таким логином уже существует');
  }
  const passwordHash = await hashPassword(input.password);
  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        fullName: input.fullName,
        login: input.login,
        passwordHash,
        role: input.role,
        position: input.position ?? null,
        phone: input.phone ?? null,
        email: input.email ?? null,
        mustChangePassword: true,
      },
    });
    // Удостоверения ведутся только у сотрудников
    if (created.role === 'USER') await ensureUserCredentials(tx, created.id);
    await audit(tx, {
      actorId: actor.id,
      action: 'user.create',
      entityType: 'User',
      entityId: created.id,
      targetUserId: created.id,
      diff: diffOf(null, created, ['fullName', 'login', 'role', 'position', 'phone', 'email']),
    });
    return created;
  });
  return toUserDto(user);
}

export async function update(actor: User, id: number, input: UpdateUserRequest) {
  const existing = await findActiveUser(id);
  const isSelf = actor.id === id;

  if (isSelf && input.role !== undefined && input.role !== existing.role) {
    throw badRequest('Нельзя изменить собственную роль');
  }
  if (isSelf && input.isActive === false) throw badRequest('Нельзя заблокировать самого себя');
  const losesAdmin =
    existing.role === 'ADMIN' && ((input.role && input.role !== 'ADMIN') || input.isActive === false);
  if (losesAdmin) await assertNotLastAdmin(id);

  const data: Prisma.UserUpdateInput = {};
  for (const field of PROFILE_FIELDS) {
    if (input[field] !== undefined) (data as Record<string, unknown>)[field] = input[field];
  }
  // Смена роли или блокировка — старые токены перестают работать сразу
  const revokeTokens =
    (input.role !== undefined && input.role !== existing.role) ||
    (input.isActive !== undefined && input.isActive !== existing.isActive);
  if (revokeTokens) data.tokenVersion = { increment: 1 };

  const user = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({ where: { id }, data });
    if (updated.role === 'USER') await ensureUserCredentials(tx, id);
    await audit(tx, {
      actorId: actor.id,
      action: 'user.update',
      entityType: 'User',
      entityId: id,
      targetUserId: id,
      diff: diffOf(existing, updated, [...PROFILE_FIELDS]),
    });
    return updated;
  });
  return toUserDto(user);
}

/** Мягкое удаление: пользователь пропадает из списков, данные и история остаются. */
export async function softDelete(actor: User, id: number) {
  const existing = await findActiveUser(id);
  if (actor.id === id) throw badRequest('Нельзя удалить самого себя');
  if (existing.role === 'ADMIN') await assertNotLastAdmin(id);
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id },
      data: { isDeleted: true, isActive: false, tokenVersion: { increment: 1 } },
    });
    await audit(tx, {
      actorId: actor.id,
      action: 'user.delete',
      entityType: 'User',
      entityId: id,
      targetUserId: id,
      diff: { isDeleted: { from: false, to: true } },
    });
  });
}

export async function resetPassword(actor: User, id: number, password: string) {
  await findActiveUser(id);
  const passwordHash = await hashPassword(password);
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id },
      data: { passwordHash, mustChangePassword: true, tokenVersion: { increment: 1 } },
    });
    await audit(tx, {
      actorId: actor.id,
      action: 'user.resetPassword',
      entityType: 'User',
      entityId: id,
      targetUserId: id,
    });
  });
}

// ---------- Собственный профиль ----------

export async function updateProfile(user: User, input: UpdateProfileRequest) {
  const data: Prisma.UserUpdateInput = {};
  if (input.phone !== undefined) data.phone = input.phone;
  if (input.email !== undefined) data.email = input.email;
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.user.update({ where: { id: user.id }, data });
    await audit(tx, {
      actorId: user.id,
      action: 'profile.update',
      entityType: 'User',
      entityId: user.id,
      targetUserId: user.id,
      diff: diffOf(user, row, ['phone', 'email']),
    });
    return row;
  });
  return toUserDto(updated);
}

export async function updateUiSettings(user: User, input: UiSettings) {
  const current = (user.uiSettings ?? {}) as UiSettings;
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { uiSettings: { ...current, ...input } },
  });
  return toUserDto(updated);
}
