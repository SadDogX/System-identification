// В БД даты удостоверений — DATE, Prisma отдаёт их как Date на полночь UTC.

export function toDbDate(date: string): Date;
export function toDbDate(date: string | null): Date | null;
export function toDbDate(date: string | null): Date | null {
  return date ? new Date(`${date}T00:00:00Z`) : null;
}

export function fromDbDate(date: Date | null): string | null {
  return date ? date.toISOString().slice(0, 10) : null;
}
