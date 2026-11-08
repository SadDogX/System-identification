export const PLANNED_WORK_COLORS = {
  normal: '#2e7d32',
  conflict: '#c62828',
} as const;

export function getYearDays(year: number) {
  const days: string[] = [];
  for (let day = new Date(Date.UTC(year, 0, 1)); day.getUTCFullYear() === year; day.setUTCDate(day.getUTCDate() + 1)) {
    days.push(day.toISOString().slice(0, 10));
  }
  return days;
}
