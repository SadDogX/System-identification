import {
  bool,
  isIsoDate,
  int,
  matches,
  object,
  oneOf,
  optional,
  optionalId,
  optionalText,
  text,
  type Infer,
} from '@app/shared';

const code = text({
  max: 50,
  pattern: [/^[A-Z][A-Z0-9_]*$/, 'Код должен состоять из заглавных латинских букв, цифр и _'],
});

export const baseSchema = object({
  name: text({ max: 150 }),
  code: optionalText(50),
});
export type BaseInput = Infer<typeof baseSchema>;

export const baseUpdateSchema = object({
  name: text({ max: 150 }),
  code: optionalText(50),
  isActive: optional(bool()),
});
export type BaseUpdateInput = Infer<typeof baseUpdateSchema>;

export const mineSchema = object({
  name: text({ max: 150 }),
  code: optionalText(50),
});
export type MineInput = Infer<typeof mineSchema>;

export const wellSchema = object({
  name: text({ max: 150 }),
  code: optionalText(50),
  clusterNumber: optionalText(50),
});
export type WellInput = Infer<typeof wellSchema>;

export const employeeProfileSchema = object({
  fullName: text({ max: 200 }),
  phone: optionalText(50),
  email: optionalText(150),
});
export type EmployeeProfileInput = Infer<typeof employeeProfileSchema>;

export const assignmentSchema = object({
  track: oneOf(['TRS', 'R_AND_M'] as const),
  baseId: optionalId(),
  positionId: optionalId(),
  supervisorEmployeeId: optionalId(),
  startsAt: matches(
    (v): v is string => typeof v === 'string' && isIsoDate(v),
    'Укажите дату в формате ГГГГ-ММ-ДД',
  ),
  reason: optionalText(2000),
});
export type AssignmentInput = Infer<typeof assignmentSchema>;

export const mineCoordinatorSchema = object({
  coordinatorEmployeeId: int({ min: 1 }),
  startsAt: matches(
    (v): v is string => typeof v === 'string' && isIsoDate(v),
    'Укажите дату в формате ГГГГ-ММ-ДД',
  ),
  reason: optionalText(2000),
});
export type MineCoordinatorInput = Infer<typeof mineCoordinatorSchema>;

export const ORG_ROLE_CODES = [
  'ADMIN',
  'MANAGER',
  'COORDINATOR',
  'SENIOR_MECHANIC',
  'MECHANIC',
  'SHOP_FOREMAN',
  'SHOP_EMPLOYEE',
  'EMPLOYEE',
] as const;

export const accountRolesSchema = object({
  roles: matches(
    (v): v is (typeof ORG_ROLE_CODES)[number][] =>
      Array.isArray(v) && v.every((item) => typeof item === 'string' && ORG_ROLE_CODES.includes(item as (typeof ORG_ROLE_CODES)[number])),
    'Список содержит неизвестную системную роль',
  ),
});
export type AccountRolesInput = Infer<typeof accountRolesSchema>;

export const statusCatalogSchema = object({
  category: oneOf(['assignment', 'contract', 'addendum', 'work'] as const),
  code,
  name: text({ max: 100 }),
  sortOrder: optional(int({ min: 0, max: 100000 })),
  allowsWork: optional(bool()),
});
export type StatusCatalogInput = Infer<typeof statusCatalogSchema>;

export const statusCatalogUpdateSchema = object({
  name: optional(text({ max: 100 })),
  sortOrder: optional(int({ min: 0, max: 100000 })),
  isActive: optional(bool()),
  allowsWork: optional(bool()),
});
export type StatusCatalogUpdateInput = Infer<typeof statusCatalogUpdateSchema>;

export const workAuthorizationSchema = object({
  wellId: int({ min: 1 }),
  workTypeId: int({ min: 1 }),
  performedAt: matches(
    (v): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)),
    'Укажите дату в формате ГГГГ-ММ-ДД',
  ),
});
export type WorkAuthorizationInput = Infer<typeof workAuthorizationSchema>;

const dateValue = matches(
  (v): v is string => typeof v === 'string' && isIsoDate(v),
  'Укажите дату в формате ГГГГ-ММ-ДД',
);

export const customerSchema = object({
  name: text({ max: 200 }),
  code: optionalText(50),
});
export type CustomerInput = Infer<typeof customerSchema>;

export const customerUpdateSchema = object({
  name: text({ max: 200 }),
  code: optionalText(50),
  isActive: optional(bool()),
});
export type CustomerUpdateInput = Infer<typeof customerUpdateSchema>;

export const contractSchema = object(
  {
    customerId: int({ min: 1 }),
    statusId: int({ min: 1 }),
    number: text({ max: 100 }),
    startsAt: dateValue,
    endsAt: dateValue,
  },
  (value) => (value.endsAt < value.startsAt ? ['endsAt', 'Дата окончания раньше даты начала'] : null),
);
export type ContractInput = Infer<typeof contractSchema>;

export const addendumSchema = object(
  {
    statusId: int({ min: 1 }),
    number: text({ max: 100 }),
    startsAt: dateValue,
    endsAt: dateValue,
    description: text({ max: 10000 }),
  },
  (value) => (value.endsAt < value.startsAt ? ['endsAt', 'Дата окончания раньше даты начала'] : null),
);
export type AddendumInput = Infer<typeof addendumSchema>;

export const contractPermissionSchema = object({
  workTypeId: int({ min: 1 }),
  isAllowed: bool(),
});
export type ContractPermissionInput = Infer<typeof contractPermissionSchema>;

export const workTypeSchema = object({
  code,
  name: text({ max: 150 }),
  requiresContractPermission: bool(),
});
export type WorkTypeInput = Infer<typeof workTypeSchema>;

export const workTypeUpdateSchema = object({
  name: text({ max: 150 }),
  requiresContractPermission: bool(),
  isActive: bool(),
});
export type WorkTypeUpdateInput = Infer<typeof workTypeUpdateSchema>;

export const wellContractBasisSchema = object(
  {
    contractId: optionalId(),
    addendumId: optionalId(),
    startsAt: dateValue,
    endsAt: optional(dateValue),
  },
  (value) => {
    if ((value.contractId == null) === (value.addendumId == null)) {
      return ['contractId', 'Укажите ровно одно основание: договор или допсоглашение'];
    }
    if (value.endsAt && value.endsAt < value.startsAt) return ['endsAt', 'Дата окончания раньше даты начала'];
    return null;
  },
);
export type WellContractBasisInput = Infer<typeof wellContractBasisSchema>;

export const workExecutionSchema = object({
  wellId: int({ min: 1 }),
  workTypeId: int({ min: 1 }),
  performedAt: dateValue,
  statusId: int({ min: 1 }),
  description: optionalText(10000),
  responsibleEmployeeIds: optional(
    matches(
      (v): v is number[] => Array.isArray(v) && v.every((item) => Number.isInteger(item) && item > 0),
      'Ожидается список идентификаторов сотрудников',
    ),
  ),
});
export type WorkExecutionInput = Infer<typeof workExecutionSchema>;

export const workAssignmentSchema = object(
  {
    baseId: int({ min: 1 }),
    locationType: oneOf(['BASE', 'CLUSTER', 'WELL'] as const),
    mineId: optionalId(),
    wellId: optionalId(),
    clusterNumber: optionalText(50),
    workTypeId: int({ min: 1 }),
    startsAt: dateValue,
    endsAt: dateValue,
    description: optionalText(10000),
    responsibleEmployeeIds: matches(
      (v): v is number[] => Array.isArray(v) && v.length > 0 && v.every((item) => Number.isInteger(item) && item > 0),
      'Выберите руководителя и сотрудников',
    ),
  },
  (value) => {
    if (value.endsAt < value.startsAt) return ['endsAt', 'Дата окончания раньше даты начала'];
    if (value.locationType === 'BASE' && (value.mineId || value.wellId || value.clusterNumber)) {
      return ['locationType', 'Для работы на базе не выбираются месторождение, куст или скважина'];
    }
    if (value.locationType === 'CLUSTER' && (!value.mineId || !value.clusterNumber || value.wellId)) {
      return ['clusterNumber', 'Для работы на кусту выберите месторождение и укажите номер куста'];
    }
    if (value.locationType === 'WELL' && (!value.mineId || !value.wellId || value.clusterNumber)) {
      return ['wellId', 'Для работы на скважине выберите месторождение и скважину'];
    }
    return null;
  },
);
export type WorkAssignmentInput = Infer<typeof workAssignmentSchema>;
