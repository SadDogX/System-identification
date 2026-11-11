import { addDays } from '@app/shared';

export interface ConflictWork {
  id: number;
  mineId: number | null;
  clusterNumber: string | null;
  locationKey?: string;
  startsAt: string;
  endsAt: string;
}

export interface WorkSegment {
  startsAt: string;
  endsAt: string;
  conflict: boolean;
}

/** Conflicts require an overlapping calendar day and distinct pads within an already Base-scoped input. */
export function conflictDatesForYear(works: ConflictWork[], year: number): Map<number, Set<string>> {
  const firstDay = `${year}-01-01`;
  const lastDay = `${year}-12-31`;
  const affected = new Map<number, Set<string>>();
  for (let i = 0; i < works.length; i += 1) {
    for (let j = i + 1; j < works.length; j += 1) {
      const left = works[i];
      const right = works[j];
      if (left.locationKey && right.locationKey
        ? left.locationKey === right.locationKey
        : left.mineId === right.mineId && left.clusterNumber === right.clusterNumber) continue;
      const overlapStart = left.startsAt > right.startsAt ? left.startsAt : right.startsAt;
      const overlapEnd = left.endsAt < right.endsAt ? left.endsAt : right.endsAt;
      const start = overlapStart < firstDay ? firstDay : overlapStart;
      const end = overlapEnd > lastDay ? lastDay : overlapEnd;
      if (start > end) continue;
      if (!affected.has(left.id)) affected.set(left.id, new Set());
      if (!affected.has(right.id)) affected.set(right.id, new Set());
      for (let day = start; day <= end; day = addDays(day, 1)) {
        affected.get(left.id)!.add(day);
        affected.get(right.id)!.add(day);
      }
    }
  }
  return affected;
}

export function splitWorkSegments(work: Pick<ConflictWork, 'startsAt' | 'endsAt'>, conflictDates: Set<string>, year: number): WorkSegment[] {
  const startsAt = work.startsAt < `${year}-01-01` ? `${year}-01-01` : work.startsAt;
  const endsAt = work.endsAt > `${year}-12-31` ? `${year}-12-31` : work.endsAt;
  if (startsAt > endsAt) return [];
  const segments: WorkSegment[] = [];
  let start = startsAt;
  let conflict = conflictDates.has(start);
  for (let day = addDays(start, 1); day <= endsAt; day = addDays(day, 1)) {
    const nextConflict = conflictDates.has(day);
    if (conflict !== nextConflict) {
      segments.push({ startsAt: start, endsAt: addDays(day, -1), conflict });
      start = day;
      conflict = nextConflict;
    }
  }
  segments.push({ startsAt: start, endsAt, conflict });
  return segments;
}
