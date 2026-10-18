import type { Credential, User } from '@prisma/client';
import type { CatalogItemDto, CatalogItemRequest } from '@app/shared';
import { prisma } from '../../core/db.ts';
import { notFound } from '../../core/errors.ts';
import { audit, diffOf } from '../../core/audit.ts';
import { backfillCatalogItem } from '../credentials/credentials.service.ts';

const FIELDS = ['name', 'validityMonths', 'sortOrder', 'isArchived'] as const;

function toDto(item: Credential): CatalogItemDto {
  return {
    id: item.id,
    name: item.name,
    validityMonths: item.validityMonths,
    sortOrder: item.sortOrder,
    isArchived: item.isArchived,
  };
}

async function findItem(id: number) {
  const item = await prisma.credential.findUnique({ where: { id } });
  if (!item) throw notFound('Позиция справочника не найдена');
  return item;
}

export async function list(includeArchived: boolean): Promise<CatalogItemDto[]> {
  const items = await prisma.credential.findMany({
    where: includeArchived ? {} : { isArchived: false },
    orderBy: [{ isArchived: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
  });
  return items.map(toDto);
}

/** Новая позиция сразу появляется у всех сотрудников пустой записью. */
export async function create(actor: User, input: CatalogItemRequest) {
  const item = await prisma.$transaction(async (tx) => {
    const created = await tx.credential.create({ data: input });
    await backfillCatalogItem(tx, created.id);
    await audit(tx, {
      actorId: actor.id,
      action: 'catalog.create',
      entityType: 'Credential',
      entityId: created.id,
      diff: diffOf(null, created, ['name', 'validityMonths']),
    });
    return created;
  });
  return toDto(item);
}

/**
 * Изменение срока не пересчитывает уже заполненные даты: удостоверение выдано
 * по старым правилам. Новый срок применяется при следующем вводе даты выдачи.
 */
export async function update(actor: User, id: number, input: CatalogItemRequest) {
  const existing = await findItem(id);
  const item = await prisma.$transaction(async (tx) => {
    const updated = await tx.credential.update({ where: { id }, data: input });
    await audit(tx, {
      actorId: actor.id,
      action: 'catalog.update',
      entityType: 'Credential',
      entityId: id,
      diff: diffOf(existing, updated, [...FIELDS]),
    });
    return updated;
  });
  return toDto(item);
}

/** Архив скрывает позицию у всех сотрудников, данные не удаляются. */
export async function setArchived(actor: User, id: number, isArchived: boolean) {
  const existing = await findItem(id);
  const item = await prisma.$transaction(async (tx) => {
    const updated = await tx.credential.update({ where: { id }, data: { isArchived } });
    // Сотрудники, созданные пока позиция была в архиве, получают пустую запись
    if (!isArchived) await backfillCatalogItem(tx, id);
    await audit(tx, {
      actorId: actor.id,
      action: isArchived ? 'catalog.archive' : 'catalog.unarchive',
      entityType: 'Credential',
      entityId: id,
      diff: diffOf(existing, updated, ['isArchived']),
    });
    return updated;
  });
  return toDto(item);
}
