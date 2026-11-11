import { int, isIsoDate, matches, object, oneOf, optionalId, optionalText, text, type Infer } from '@app/shared';

const isoDate = matches((value): value is string => typeof value === 'string' && isIsoDate(value), 'Specify a real calendar date in YYYY-MM-DD format');
const idList = matches((value): value is number[] => Array.isArray(value) && value.length > 0 && value.every((id) => Number.isInteger(id) && id > 0), 'Select at least one employee');

export const plannedWorkSchema = object({
  name: text({ max: 200 }),
  baseId: int({ min: 1 }),
  locationType: oneOf(['BASE', 'CLUSTER', 'WELL'] as const),
  mineId: optionalId(),
  clusterNumber: optionalText(50),
  wellId: optionalId(),
  workTypeId: int({ min: 1 }),
  startsAt: isoDate,
  endsAt: isoDate,
  coordinatorEmployeeId: int({ min: 1 }),
  supervisorEmployeeId: int({ min: 1 }),
  employeeIds: idList,
  description: optionalText(10000),
});
export type PlannedWorkInput = Infer<typeof plannedWorkSchema>;

export const plannedWorkStatusSchema = object({
  statusCode: oneOf(['IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const),
});
export type PlannedWorkStatusInput = Infer<typeof plannedWorkStatusSchema>;

export const plannedWorkYearSchema = object({ year: int({ min: 1900, max: 2200 }) });
export type PlannedWorkYear = Infer<typeof plannedWorkYearSchema>;
