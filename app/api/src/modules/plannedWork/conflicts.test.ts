import { describe, expect, it } from 'vitest';
import { conflictDatesForYear, splitWorkSegments, type ConflictWork } from './conflicts.ts';

const work = (id: number, pad: string, startsAt: string, endsAt: string, mineId = 1): ConflictWork => ({ id, mineId, clusterNumber: pad, startsAt, endsAt });

describe('planned work conflict ranges', () => {
  it('marks all overlapping days across pads and splits green tails correctly', () => {
    const rows = [work(1, 'K133', '2025-11-10', '2025-11-15'), work(2, 'K134', '2025-11-12', '2025-11-18'), work(3, 'K135', '2025-11-14', '2025-11-20')];
    const conflicts = conflictDatesForYear(rows, 2025);
    expect([...conflicts.get(1)!]).toEqual(['2025-11-12', '2025-11-13', '2025-11-14', '2025-11-15']);
    expect(splitWorkSegments(rows[0], conflicts.get(1)!, 2025)).toEqual([
      { startsAt: '2025-11-10', endsAt: '2025-11-11', conflict: false },
      { startsAt: '2025-11-12', endsAt: '2025-11-15', conflict: true },
    ]);
    expect(splitWorkSegments(rows[1], conflicts.get(2)!, 2025)).toEqual([
      { startsAt: '2025-11-12', endsAt: '2025-11-18', conflict: true },
    ]);
    expect(splitWorkSegments(rows[2], conflicts.get(3)!, 2025)).toEqual([
      { startsAt: '2025-11-14', endsAt: '2025-11-18', conflict: true },
      { startsAt: '2025-11-19', endsAt: '2025-11-20', conflict: false },
    ]);
  });

  it('does not conflict for same pad alone, but does across different field pads', () => {
    expect(conflictDatesForYear([work(1, 'K1', '2026-04-01', '2026-04-04'), work(2, 'K1', '2026-04-02', '2026-04-03')], 2026).size).toBe(0);
    const conflicts = conflictDatesForYear([work(1, 'K1', '2026-04-01', '2026-04-04'), work(2, 'K2', '2026-04-02', '2026-04-03')], 2026);
    expect([...conflicts.get(1)!]).toEqual(['2026-04-02', '2026-04-03']);
  });

  it('clips cross-year ranges to the selected year and includes leap day', () => {
    const conflicts = conflictDatesForYear([work(1, 'K1', '2023-12-30', '2024-03-02'), work(2, 'K2', '2024-02-29', '2024-03-01')], 2024);
    expect([...conflicts.get(1)!]).toEqual(['2024-02-29', '2024-03-01']);
    expect(splitWorkSegments({ startsAt: '2023-12-30', endsAt: '2024-03-02' }, conflicts.get(1)!, 2024)).toEqual([
      { startsAt: '2024-01-01', endsAt: '2024-02-28', conflict: false },
      { startsAt: '2024-02-29', endsAt: '2024-03-01', conflict: true },
      { startsAt: '2024-03-02', endsAt: '2024-03-02', conflict: false },
    ]);
  });
});
