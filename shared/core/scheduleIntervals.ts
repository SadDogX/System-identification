import { addDays, daysBetween } from './dates.ts';
import type { WorkDayStatus } from './schemas.ts';

export interface ScheduleIntervalRange {
  userId: number;
  startDate: string;
  endDate: string;
  status: WorkDayStatus;
}

export interface ScheduleDay {
  userId: number;
  date: string;
  status: WorkDayStatus;
}

export function groupScheduleDays(days: readonly ScheduleDay[]): ScheduleIntervalRange[] {
  const sorted = [...days].sort((a, b) => a.userId - b.userId || a.date.localeCompare(b.date));
  const intervals: ScheduleIntervalRange[] = [];

  for (const day of sorted) {
    const previous = intervals.at(-1);
    if (
      previous &&
      previous.userId === day.userId &&
      previous.status === day.status &&
      addDays(previous.endDate, 1) === day.date
    ) {
      previous.endDate = day.date;
    } else {
      intervals.push({ userId: day.userId, startDate: day.date, endDate: day.date, status: day.status });
    }
  }
  return intervals;
}

export function groupScheduleDates(dates: readonly string[]): Array<{ startDate: string; endDate: string }> {
  const sorted = [...new Set(dates)].sort();
  const ranges: Array<{ startDate: string; endDate: string }> = [];
  for (const date of sorted) {
    const previous = ranges.at(-1);
    if (previous && addDays(previous.endDate, 1) === date) previous.endDate = date;
    else ranges.push({ startDate: date, endDate: date });
  }
  return ranges;
}

export function expandScheduleIntervals(
  intervals: readonly ScheduleIntervalRange[],
  startDate: string,
  endDate: string,
): Map<string, WorkDayStatus> {
  const expanded = new Map<string, WorkDayStatus>();
  for (const interval of intervals) {
    const start = interval.startDate > startDate ? interval.startDate : startDate;
    const end = interval.endDate < endDate ? interval.endDate : endDate;
    if (start > end) continue;
    for (let date = start; date <= end; date = addDays(date, 1)) {
      expanded.set(date, interval.status);
    }
  }
  return expanded;
}

export function countScheduleDaysByStatus(
  intervals: readonly ScheduleIntervalRange[],
  startDate: string,
  endDate: string,
): Record<WorkDayStatus, number> {
  const stats: Record<WorkDayStatus, number> = {
    WORK: 0,
    FREE_SHIFT: 0,
    TRAVEL: 0,
    SICK_LEAVE: 0,
    VACATION: 0,
    TRAINING: 0,
  };
  for (const interval of intervals) {
    const start = interval.startDate > startDate ? interval.startDate : startDate;
    const end = interval.endDate < endDate ? interval.endDate : endDate;
    if (start <= end) stats[interval.status] += daysBetween(start, end) + 1;
  }
  return stats;
}
