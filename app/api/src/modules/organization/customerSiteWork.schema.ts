import { int, matches, object, text, type Infer } from '@app/shared';

const isoDate = matches((value): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value), 'Укажите дату в формате ГГГГ-ММ-ДД');

export const customerSiteWorkSchema = object(
  {
    name: text({ max: 200 }),
    customerId: int({ min: 1 }),
    mineId: int({ min: 1 }),
    wellId: int({ min: 1 }),
    startsAt: isoDate,
    expectedEndAt: isoDate,
    supervisorEmployeeId: int({ min: 1 }),
  },
  (value) => value.expectedEndAt < value.startsAt ? ['expectedEndAt', 'Ожидаемая дата окончания раньше даты начала'] : null,
);
export type CustomerSiteWorkInput = Infer<typeof customerSiteWorkSchema>;
