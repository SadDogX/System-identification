import { int, isIsoDate, matches, object, text, type Infer } from '@app/shared';

const isoDate = matches((value): value is string => typeof value === 'string' && isIsoDate(value), 'Specify a real calendar date in YYYY-MM-DD format');
const idList = matches((value): value is number[] => Array.isArray(value) && value.length > 0 && value.every((id) => Number.isInteger(id) && id > 0), 'Select at least one employee');

export const plannedWorkSchema = object({
  name: text({ max: 200 }),
  mineId: int({ min: 1 }),
  clusterNumber: text({ max: 50 }),
  wellId: int({ min: 1 }),
  startsAt: isoDate,
  endsAt: isoDate,
  coordinatorEmployeeId: int({ min: 1 }),
  supervisorEmployeeId: int({ min: 1 }),
  employeeIds: idList,
});
export type PlannedWorkInput = Infer<typeof plannedWorkSchema>;

export const plannedWorkYearSchema = object({ year: int({ min: 1900, max: 2200 }) });
export type PlannedWorkYear = Infer<typeof plannedWorkYearSchema>;
