import { useMemo, useState } from 'react';
import { api } from '../../core/api.ts';
import { useCurrentUser } from '../../core/auth.tsx';
import { invalidate, useAction, useQuery } from '../../core/data.ts';
import { Alert, PageHeader, SelectField, TextField, TextArea } from '@app/shared/ui';
import { ActionError } from '../../widgets/feedback/ActionError';

type LocationType = 'BASE' | 'CLUSTER' | 'WELL';
interface Base { id: number; name: string; code?: string | null }
interface Mine { id: number; name: string; baseId: number; base: Base }
interface Well { id: number; name: string; clusterNumber: string | null }
interface WorkType { id: number; name: string }
interface Employee {
  id: number;
  user: {
    id: number;
    fullName: string;
    isActive?: boolean;
    systemRoles: { systemRole: { code: string } }[];
  };
  assignments: { baseId: number | null; activeEmployeeId?: number | null; base?: Base | null }[];
}
interface EmployeeSelf extends Employee {
  user: Employee['user'] & { systemRoles: { systemRole: { code: string; name?: string; isActive?: boolean } }[] };
}
interface WorkAssignment {
  id: number;
  locationType: LocationType;
  clusterNumber: string | null;
  startsAt: string;
  endsAt: string;
  description: string | null;
  base: Base;
  mine: { id: number; name: string } | null;
  well: { id: number; name: string; clusterNumber: string | null } | null;
  workType: { id: number; name: string };
  status: { id: number; code: string; name: string };
  responsible: { employee: { user: { id: number; fullName: string } } }[];
}

const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const dateLabel = (value: string) => value.slice(0, 10).split('-').reverse().join('.');

export function WorkAssignmentsPage() {
  const user = useCurrentUser();
  const isAdmin = user.role === 'ADMIN';
  const selfQuery = useQuery('org:work-assignments:self', () => api.get<EmployeeSelf>(`/org/users/${user.id}/employee`));
  const roles = selfQuery.data?.user.systemRoles.map((grant) => grant.systemRole.code) ?? user.systemRoles;
  const canManage = isAdmin || roles.includes('MANAGER') || roles.includes('COORDINATOR');
  const isManager = isAdmin || roles.includes('MANAGER');

  const assignmentsQuery = useQuery('org:work-assignments', () => api.get<WorkAssignment[]>('/org/work-assignments'));
  const employeesQuery = useQuery(canManage ? 'org:work-assignments:employees' : null, () => api.get<Employee[]>('/org/employees'));
  const basesQuery = useQuery(isManager ? 'org:work-assignments:bases' : null, () => api.get<Base[]>('/org/bases'));
  const minesQuery = useQuery(canManage ? 'org:work-assignments:mines' : null, () => api.get<Mine[]>('/org/mines'));
  const typesQuery = useQuery(canManage ? 'org:work-assignments:types' : null, () => api.get<WorkType[]>('/org/work-types'));

  const [locationType, setLocationType] = useState<LocationType>('WELL');
  const [baseId, setBaseId] = useState('');
  const [mineId, setMineId] = useState('');
  const [wellId, setWellId] = useState('');
  const [clusterNumber, setClusterNumber] = useState('');
  const [workTypeId, setWorkTypeId] = useState('');
  const [startsAt, setStartsAt] = useState(today());
  const [endsAt, setEndsAt] = useState(today());
  const [description, setDescription] = useState('');
  const [responsibleEmployeeIds, setResponsibleEmployeeIds] = useState<number[]>([]);
  const [message, setMessage] = useState('');

  const wellsQuery = useQuery(
    locationType !== 'BASE' && mineId ? `org:work-assignments:wells:${mineId}` : null,
    () => api.get<Well[]>(`/org/mines/${mineId}/wells`),
  );
  const bases = useMemo(() => {
    if (isManager) return basesQuery.data ?? [];
    const available = new Map<number, Base>();
    for (const mine of minesQuery.data ?? []) available.set(mine.base.id, mine.base);
    const selfBase = selfQuery.data?.assignments.find((assignment) => assignment.activeEmployeeId && assignment.base)?.base;
    if (selfBase) available.set(selfBase.id, selfBase);
    return [...available.values()];
  }, [basesQuery.data, isManager, minesQuery.data, selfQuery.data]);
  const mines = (minesQuery.data ?? []).filter((mine) => !baseId || mine.baseId === Number(baseId));
  const wells = wellsQuery.data ?? [];
  const employees = employeesQuery.data ?? [];
  const team = (selfQuery.data && !employees.some((employee) => employee.id === selfQuery.data?.id)
    ? [...employees, selfQuery.data]
    : employees).filter((employee) => employee.user.isActive !== false);
  const workTypes = typesQuery.data ?? [];
  const clusters = [...new Set(wells.map((well) => well.clusterNumber).filter((value): value is string => !!value))];
  const assignments = assignmentsQuery.data ?? [];

  const create = useAction(() => api.post('/org/work-assignments', {
    baseId: Number(baseId),
    locationType,
    ...(locationType !== 'BASE' ? { mineId: Number(mineId) } : {}),
    ...(locationType === 'CLUSTER' ? { clusterNumber } : {}),
    ...(locationType === 'WELL' ? { wellId: Number(wellId) } : {}),
    workTypeId: Number(workTypeId),
    startsAt,
    endsAt,
    description: description || null,
    responsibleEmployeeIds,
  }), {
    onSuccess: () => {
      setMessage('Выезд на работу запланирован.');
      setDescription('');
      setResponsibleEmployeeIds([]);
      invalidate('org:work-assignments');
    },
  });

  const firstError = [
    selfQuery.error,
    assignmentsQuery.error,
    employeesQuery.error,
    basesQuery.error,
    minesQuery.error,
    typesQuery.error,
    wellsQuery.error,
  ].find(Boolean);

  const locationLabel = (assignment: WorkAssignment) => {
    if (assignment.locationType === 'BASE') return `База: ${assignment.base.name}`;
    if (assignment.locationType === 'CLUSTER') return `${assignment.mine?.name ?? 'Месторождение'} · куст ${assignment.clusterNumber}`;
    return `${assignment.mine?.name ?? 'Месторождение'} · куст ${assignment.well?.clusterNumber ?? '—'} · скважина ${assignment.well?.name ?? '—'}`;
  };

  return <>
    <PageHeader title={canManage ? 'Выезды на работы' : 'Мои выезды'} subtitle="Планируйте место, сроки, вид работ и состав команды" />
    {firstError && <Alert>{firstError}</Alert>}
    {message && <Alert kind="success">{message}</Alert>}

    {canManage && <section className="panel" style={{ padding: 18, marginBottom: 16 }}>
      <h2 className="section-title">Новый план работ</h2>
      <form className="stack" onSubmit={(event) => {
        event.preventDefault();
        setMessage('');
        create.run();
      }}>
        <div className="form-grid">
          <SelectField label="База *" value={baseId} onChange={(event) => {
            setBaseId(event.target.value);
            setMineId('');
            setWellId('');
          }}>
            <option value="">Выберите базу</option>
            {bases.map((base) => <option key={base.id} value={base.id}>{base.name}</option>)}
          </SelectField>
          <SelectField label="Место работы *" value={locationType} onChange={(event) => {
            setLocationType(event.target.value as LocationType);
            setMineId('');
            setWellId('');
            setClusterNumber('');
          }}>
            <option value="WELL">Скважина</option>
            <option value="CLUSTER">Куст</option>
            <option value="BASE">База</option>
          </SelectField>
          {locationType !== 'BASE' && <SelectField label="Месторождение *" value={mineId} onChange={(event) => {
            setMineId(event.target.value);
            setWellId('');
          }}>
            <option value="">Выберите месторождение</option>
            {mines.map((mine) => <option key={mine.id} value={mine.id}>{mine.name}</option>)}
          </SelectField>}
          {locationType === 'CLUSTER' && <SelectField label="Номер куста *" value={clusterNumber} onChange={(event) => setClusterNumber(event.target.value)}>
            <option value="">Выберите куст</option>
            {clusters.map((cluster) => <option key={cluster} value={cluster}>{cluster}</option>)}
          </SelectField>}
          {locationType === 'WELL' && <SelectField label="Скважина *" value={wellId} onChange={(event) => setWellId(event.target.value)}>
            <option value="">Выберите скважину</option>
            {wells.map((well) => <option key={well.id} value={well.id}>{well.name}{well.clusterNumber ? ` · куст ${well.clusterNumber}` : ''}</option>)}
          </SelectField>}
          <SelectField label="Вид работ *" value={workTypeId} onChange={(event) => setWorkTypeId(event.target.value)}>
            <option value="">Выберите вид работ</option>
            {workTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
          </SelectField>
          <TextField label="Дата начала *" type="date" required value={startsAt} onChange={(event) => setStartsAt(event.target.value)} />
          <TextField label="Дата окончания *" type="date" required min={startsAt} value={endsAt} onChange={(event) => setEndsAt(event.target.value)} />
        </div>
        <TextArea label="Комментарий" value={description} onChange={(event) => setDescription(event.target.value)} rows={3} />
        <SelectField
          label="Руководитель и сотрудники *"
          multiple
          value={responsibleEmployeeIds.map(String)}
          onChange={(event) => setResponsibleEmployeeIds(Array.from(event.target.selectedOptions, (option) => Number(option.value)))}
          size={Math.min(8, Math.max(3, team.length))}
        >
          {team.map((employee) => {
            const roleCodes = employee.user.systemRoles.map((grant) => grant.systemRole.code);
            const leader = roleCodes.some((code) => code === 'MANAGER' || code === 'COORDINATOR');
            return <option key={employee.id} value={employee.id}>{employee.user.fullName}{leader ? ' · руководитель' : ''}</option>;
          })}
        </SelectField>
        <p className="muted small">В составе команды должен быть хотя бы один менеджер или координатор. Удерживайте Ctrl, чтобы выбрать нескольких сотрудников.</p>
        <ActionError error={create.error} />
        <button className="btn btn-primary" disabled={
          create.pending || !baseId || !workTypeId || !responsibleEmployeeIds.length ||
          (locationType !== 'BASE' && !mineId) ||
          (locationType === 'CLUSTER' && !clusterNumber.trim()) ||
          (locationType === 'WELL' && !wellId) ||
          endsAt < startsAt
        }>{create.pending ? 'Сохранение…' : 'Запланировать выезд'}</button>
      </form>
    </section>}

    <section className="panel table-wrap">
      <table className="table">
        <thead><tr><th>Сроки</th><th>Место</th><th>Работа</th><th>Команда</th><th>Статус</th></tr></thead>
        <tbody>{assignments.map((assignment) => <tr key={assignment.id}>
          <td>{dateLabel(assignment.startsAt)} – {dateLabel(assignment.endsAt)}</td>
          <td>{locationLabel(assignment)}</td>
          <td>{assignment.workType.name}{assignment.description && <div className="muted small">{assignment.description}</div>}</td>
          <td>{assignment.responsible.map((item) => item.employee.user.fullName).join(', ')}</td>
          <td>{assignment.status.name}</td>
        </tr>)}</tbody>
      </table>
      {assignments.length === 0 && <div className="empty">Запланированных выездов нет.</div>}
    </section>
  </>;
}
