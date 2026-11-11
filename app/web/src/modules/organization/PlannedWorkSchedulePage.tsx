import { useMemo, useState } from 'react';
import { api } from '../../core/api.ts';
import { useCurrentUser } from '../../core/auth.tsx';
import { invalidate, useAction, useQuery } from '../../core/data.ts';
import { Alert, Dialog, PageHeader, SelectField, TextArea, TextField } from '@app/shared/ui';
import { PLANNED_WORK_COLORS, getYearDays } from '../../widgets/schedule/plannedWorkPresentation.ts';

interface Named { id: number; name: string }
interface Mine extends Named { baseId: number; base: Named }
interface Well extends Named { clusterNumber: string | null }
interface Person { id: number; fullName: string; baseIds: number[]; mineIds?: number[] }
interface WorkStatus { id: number; code: string; name: string }
interface Options {
  bases: Named[];
  mines: Mine[];
  coordinators: Person[];
  employees: Person[];
  workTypes: Named[];
  statuses: WorkStatus[];
  selfEmployeeId: number | null;
}
interface Segment { startsAt: string; endsAt: string; conflict: boolean }
interface WorkRow {
  id: number;
  baseId: number;
  locationType: 'BASE' | 'CLUSTER' | 'WELL';
  mineId: number | null;
  clusterNumber: string | null;
  wellId: number | null;
  workTypeId: number | null;
  name: string;
  description: string | null;
  startsAt: string;
  endsAt: string;
  coordinatorEmployeeId: number;
  supervisorEmployeeId: number;
  base: Named;
  mine: Mine | null;
  well: Named | null;
  workType: Named | null;
  status: WorkStatus;
  coordinator: { id: number; user: Named };
  supervisor: { id: number; user: Named };
  employees: { employee: { id: number; user: Named } }[];
  segments: Segment[];
  conflictDates: string[];
}

type DialogMode = 'create' | 'view' | 'edit';
const currentYear = new Date().getFullYear();
const years = Array.from({ length: 6 }, (_, index) => currentYear - index);
const today = () => new Date().toISOString().slice(0, 10);
const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
const emptyValues = () => ({
  name: '', description: '', baseId: '', locationType: 'WELL' as WorkRow['locationType'], mineId: '',
  clusterNumber: '', wellId: '', workTypeId: '', startsAt: today(), endsAt: today(),
  coordinatorEmployeeId: '', supervisorEmployeeId: '', employeeIds: [] as string[],
});

export function PlannedWorkSchedulePage() {
  const user = useCurrentUser();
  const [year, setYear] = useState(currentYear);
  const [dialog, setDialog] = useState<{ mode: DialogMode; id?: number } | null>(null);
  const [values, setValues] = useState(emptyValues);
  const isAdmin = user.systemRoles.includes('ADMIN');
  const canManage = isAdmin || user.systemRoles.includes('MANAGER') || user.systemRoles.includes('COORDINATOR');
  const options = useQuery(canManage ? 'planned-work:options' : null, () => api.get<Options>('/planned-work/options'));
  const schedule = useQuery(`planned-work:list:${year}`, () => api.get<{ year: number; rows: WorkRow[] }>('/planned-work', { year }));
  const currentEmployeeId = options.data?.selfEmployeeId;
  const canEditRow = (row: WorkRow) => isAdmin || user.systemRoles.includes('MANAGER') || (
    user.systemRoles.includes('COORDINATOR') &&
    (row.coordinatorEmployeeId === currentEmployeeId || (options.data?.mines ?? []).some((mine) => row.mineId !== null ? mine.id === row.mineId : mine.baseId === row.baseId))
  );
  const selectedBase = options.data?.bases.find((base) => String(base.id) === values.baseId);
  const selectedMine = options.data?.mines.find((mine) => String(mine.id) === values.mineId);
  const wellsQuery = useQuery(selectedMine ? `planned-work:wells:${selectedMine.id}` : null, () => api.get<Well[]>(`/org/mines/${selectedMine!.id}/wells`));
  const allWells = wellsQuery.data ?? [];
  const clusters = [...new Set(allWells.map((well) => well.clusterNumber).filter((value): value is string => !!value))];
  const wells = allWells.filter((well) => well.clusterNumber === values.clusterNumber);
  const employees = (options.data?.employees ?? []).filter((person) => person.baseIds.includes(Number(values.baseId)));
  const coordinators = values.locationType === 'BASE'
    ? employees
    : (options.data?.coordinators ?? []).filter((person) => person.baseIds.includes(Number(values.baseId)) && person.mineIds?.includes(Number(values.mineId)));
  const rows = schedule.data?.rows ?? [];
  const padGroups = useMemo(() => {
    const grouped = new Map<string, { key: string; label: string; rows: WorkRow[] }>();
    for (const row of rows) {
      const locationKey = row.locationType === 'BASE'
        ? `base:${row.baseId}`
        : `cluster:${row.mineId}:${row.clusterNumber ?? row.wellId ?? 'unknown'}`;
      const label = row.locationType === 'BASE'
        ? `${row.base.name} · База`
        : `${row.mine?.name ?? row.base.name} · ${row.clusterNumber ? `куст ${row.clusterNumber}` : row.well?.name ?? 'место не указано'}`;
      const group = grouped.get(locationKey) ?? { key: locationKey, label, rows: [] };
      group.rows.push(row);
      grouped.set(locationKey, group);
    }
    return [...grouped.values()];
  }, [rows]);
  const days = useMemo(() => getYearDays(year), [year]);
  const monthDays = useMemo(() => Array.from({ length: 12 }, (_, month) => days.filter((day) => Number(day.slice(5, 7)) === month + 1)), [days]);

  const resetForBase = (baseId: string) => setValues((current) => ({ ...current, baseId, mineId: '', clusterNumber: '', wellId: '', coordinatorEmployeeId: '', supervisorEmployeeId: '', employeeIds: [] }));
  const resetForMine = (mineId: string) => setValues((current) => ({ ...current, mineId, clusterNumber: '', wellId: '', coordinatorEmployeeId: '', supervisorEmployeeId: '', employeeIds: [] }));
  const save = useAction(async () => {
    const locationValid = values.locationType === 'BASE'
      ? Boolean(selectedBase)
      : Boolean(selectedMine && (values.locationType === 'CLUSTER' ? values.clusterNumber : values.wellId));
    if (!values.name.trim() || !values.baseId || !locationValid || !values.workTypeId || !values.coordinatorEmployeeId || !values.supervisorEmployeeId || !values.employeeIds.length || values.endsAt < values.startsAt) {
      throw new Error('Заполните обязательные поля и проверьте период работы.');
    }
    const payload = {
      name: values.name.trim(),
      description: values.description || null,
      baseId: Number(values.baseId),
      locationType: values.locationType,
      ...(values.locationType !== 'BASE' && { mineId: Number(values.mineId) }),
      ...(values.locationType === 'CLUSTER' && { clusterNumber: values.clusterNumber }),
      ...(values.locationType === 'WELL' && { wellId: Number(values.wellId) }),
      workTypeId: Number(values.workTypeId),
      startsAt: values.startsAt,
      endsAt: values.endsAt,
      coordinatorEmployeeId: Number(values.coordinatorEmployeeId),
      supervisorEmployeeId: Number(values.supervisorEmployeeId),
      employeeIds: values.employeeIds.map(Number),
    };
    if (dialog?.mode === 'edit' && dialog.id) await api.put(`/planned-work/${dialog.id}`, payload);
    else await api.post('/planned-work', payload);
  }, { onSuccess: () => { setDialog(null); invalidate('planned-work:'); } });
  const remove = useAction((id: number) => api.delete(`/planned-work/${id}`), { onSuccess: () => { setDialog(null); invalidate('planned-work:'); } });
  const updateStatus = useAction((statusCode: string) => api.patch(`/planned-work/${dialog?.id}/status`, { statusCode }), {
    onSuccess: () => { setDialog(null); invalidate('planned-work:'); },
  });

  const openCreate = () => {
    const next = emptyValues();
    if (options.data?.bases.length === 1) next.baseId = String(options.data.bases[0].id);
    if (user.systemRoles.includes('COORDINATOR') && options.data?.selfEmployeeId) next.coordinatorEmployeeId = String(options.data.selfEmployeeId);
    setValues(next);
    setDialog({ mode: 'create' });
  };
  const openExisting = async (id: number, mode: 'view' | 'edit') => {
    const row = await api.get<WorkRow>(`/planned-work/${id}`);
    setValues({
      name: row.name,
      description: row.description ?? '',
      baseId: String(row.baseId),
      locationType: row.locationType,
      mineId: row.mineId === null ? '' : String(row.mineId),
      clusterNumber: row.clusterNumber ?? '',
      wellId: row.wellId === null ? '' : String(row.wellId),
      workTypeId: row.workTypeId === null ? '' : String(row.workTypeId),
      startsAt: row.startsAt,
      endsAt: row.endsAt,
      coordinatorEmployeeId: String(row.coordinatorEmployeeId),
      supervisorEmployeeId: String(row.supervisorEmployeeId),
      employeeIds: row.employees.map((item) => String(item.employee.id)),
    });
    setDialog({ mode, id });
  };
  const spanRow = (row: WorkRow) => {
    const cells = [];
    let cursor = 0;
    while (cursor < days.length) {
      const day = days[cursor];
      const segment = row.segments.find((item) => day >= item.startsAt && day <= item.endsAt);
      if (!segment) {
        cells.push(<td key={day} className="planned-work-empty" aria-label={`${row.name}, ${day}`} />);
        cursor += 1;
        continue;
      }
      const span = daysBetween(day, segment.endsAt) + 1;
      const background = segment.conflict
        ? PLANNED_WORK_COLORS.conflict
        : row.status.code === 'CANCELLED' ? '#9aa3ad'
          : row.status.code === 'COMPLETED' ? '#43936f'
            : PLANNED_WORK_COLORS.normal;
      cells.push(<td key={`${row.id}-${day}`} colSpan={span} className="planned-work-segment" style={{ background }} title={`${row.name} · ${row.status.name}: ${segment.startsAt} – ${segment.endsAt}${segment.conflict ? ' · conflict' : ''}`}><button type="button" onClick={(event) => { event.stopPropagation(); void openExisting(row.id, canEditRow(row) && row.status.code === 'PLANNED' ? 'edit' : 'view'); }}>{row.name}</button></td>);
      cursor += span;
    }
    return cells;
  };
  const rowBeingEdited = dialog?.id ? rows.find((row) => row.id === dialog.id) : undefined;
  const availableTransitions = rowBeingEdited?.status.code === 'PLANNED'
    ? [{ code: 'IN_PROGRESS', label: 'Начать' }, { code: 'CANCELLED', label: 'Отменить' }]
    : rowBeingEdited?.status.code === 'IN_PROGRESS'
      ? [{ code: 'COMPLETED', label: 'Завершить' }, { code: 'CANCELLED', label: 'Отменить' }]
      : [];

  return <>
    <PageHeader title="План работ" subtitle="Календарный план работ и выездов с индикацией пересечений" actions={canManage ? <button type="button" className="btn btn-primary" onClick={openCreate}>Запланировать работу</button> : undefined} />
    {schedule.error && <Alert>{schedule.error}</Alert>}{options.error && <Alert>{options.error}</Alert>}{remove.error && <Alert>{String(remove.error)}</Alert>}{updateStatus.error && <Alert>{String(updateStatus.error)}</Alert>}
    <section className="panel pad row wrap planned-work-controls"><SelectField label="Год" value={String(year)} onChange={(event) => setYear(Number(event.target.value))}>{years.map((value) => <option key={value} value={value}>{value}</option>)}</SelectField><div className="schedule-legend" aria-label="Conflict legend"><span className="schedule-legend-item"><i style={{ background: PLANNED_WORK_COLORS.normal }} />Без конфликта</span><span className="schedule-legend-item"><i style={{ background: PLANNED_WORK_COLORS.conflict }} />Пересечение работ</span><span className="schedule-legend-item"><i style={{ background: '#43936f' }} />Завершена</span><span className="schedule-legend-item"><i style={{ background: '#9aa3ad' }} />Отменена</span></div></section>
    <div className="annual-schedule-scroll-host planned-work-scroll-host"><div className="annual-schedule-wrap planned-work-scroll"><table className="annual-schedule planned-work-table">
      <thead><tr><th className="annual-name" rowSpan={3}>База / место / куст</th><th className="planned-work-work-name" rowSpan={3}>Работа</th>{monthDays.map((month, index) => <th className={`annual-month month-${index % 2}`} key={index} colSpan={month.length}>{new Intl.DateTimeFormat('ru-RU', { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(year, index, 1)))}</th>)}</tr><tr>{days.map((date) => <th key={`weekday-${date}`} className="annual-day-head">{new Intl.DateTimeFormat('ru-RU', { weekday: 'short', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`))}</th>)}</tr><tr>{days.map((date) => <th key={date} className="annual-day-head">{Number(date.slice(8, 10))}</th>)}</tr></thead>
      <tbody>{padGroups.flatMap((group) => group.rows.map((row, index) => <tr key={row.id} className="planned-work-row" onClick={() => void openExisting(row.id, canEditRow(row) && row.status.code === 'PLANNED' ? 'edit' : 'view')}>
        {index === 0 && <th className="annual-name planned-work-name" rowSpan={group.rows.length}>{group.label}</th>}
        <th className="planned-work-work-name"><span>{row.name}</span><div className="muted small">{row.workType?.name ?? 'Вид работ не указан'} · {row.status.name}</div></th>
        {spanRow(row)}
      </tr>))}</tbody>
    </table></div></div>
    {dialog && <Dialog open title={dialog.mode === 'view' ? 'Плановая работа' : dialog.mode === 'edit' ? 'Изменить плановую работу' : 'Новая плановая работа'} onClose={() => setDialog(null)} onSubmit={dialog.mode === 'view' ? undefined : () => save.run()} actions={<>
      <button type="button" className="btn" onClick={() => setDialog(null)}>Закрыть</button>
      {dialog.mode !== 'view' && <button type="submit" className="btn btn-primary" disabled={save.pending}>Сохранить</button>}
      {dialog.mode === 'edit' && dialog.id && rowBeingEdited?.status.code === 'PLANNED' && canEditRow(rowBeingEdited) && <button type="button" className="btn btn-danger" disabled={remove.pending} onClick={() => remove.run(dialog.id!)}>Удалить</button>}
    </>}>
      <TextField label="Наименование *" disabled={dialog.mode === 'view'} value={values.name} onChange={(event) => setValues((current) => ({ ...current, name: event.target.value }))} />
      <SelectField label="Вид работ *" disabled={dialog.mode === 'view'} value={values.workTypeId} onChange={(event) => setValues((current) => ({ ...current, workTypeId: event.target.value }))}><option value="">Выберите вид работ</option>{(options.data?.workTypes ?? []).map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</SelectField>
      <SelectField label="База *" disabled={dialog.mode === 'view'} value={values.baseId} onChange={(event) => resetForBase(event.target.value)}><option value="">Выберите базу</option>{(options.data?.bases ?? []).map((base) => <option key={base.id} value={base.id}>{base.name}</option>)}</SelectField>
      <SelectField label="Место работ *" disabled={dialog.mode === 'view'} value={values.locationType} onChange={(event) => setValues((current) => ({ ...current, locationType: event.target.value as WorkRow['locationType'], mineId: '', clusterNumber: '', wellId: '', coordinatorEmployeeId: '', supervisorEmployeeId: '', employeeIds: [] }))}><option value="WELL">Скважина</option><option value="CLUSTER">Куст</option><option value="BASE">База</option></SelectField>
      {values.locationType !== 'BASE' && <SelectField label="Месторождение *" disabled={dialog.mode === 'view' || !selectedBase} value={values.mineId} onChange={(event) => resetForMine(event.target.value)}><option value="">Выберите месторождение</option>{(options.data?.mines ?? []).filter((mine) => mine.baseId === Number(values.baseId)).map((mine) => <option key={mine.id} value={mine.id}>{mine.name}</option>)}</SelectField>}
      {values.locationType !== 'BASE' && <SelectField label="Куст / pad *" disabled={dialog.mode === 'view' || !selectedMine} value={values.clusterNumber} onChange={(event) => setValues((current) => ({ ...current, clusterNumber: event.target.value, wellId: '' }))}><option value="">Выберите куст</option>{clusters.map((cluster) => <option key={cluster} value={cluster}>{cluster}</option>)}</SelectField>}
      {values.locationType === 'WELL' && <SelectField label="Скважина *" disabled={dialog.mode === 'view' || !values.clusterNumber} value={values.wellId} onChange={(event) => setValues((current) => ({ ...current, wellId: event.target.value }))}><option value="">Выберите скважину</option>{wells.map((well) => <option key={well.id} value={well.id}>{well.name}</option>)}</SelectField>}
      <div className="form-grid"><TextField label="Начало *" type="date" disabled={dialog.mode === 'view'} value={values.startsAt} onChange={(event) => setValues((current) => ({ ...current, startsAt: event.target.value }))} /><TextField label="Окончание *" type="date" min={values.startsAt} disabled={dialog.mode === 'view'} value={values.endsAt} onChange={(event) => setValues((current) => ({ ...current, endsAt: event.target.value }))} /></div>
      <SelectField label={values.locationType === 'BASE' ? 'Ответственный *' : 'Координатор *'} disabled={dialog.mode === 'view' || !values.baseId} value={values.coordinatorEmployeeId} onChange={(event) => setValues((current) => ({ ...current, coordinatorEmployeeId: event.target.value }))}><option value="">Выберите ответственного</option>{coordinators.map((person) => <option key={person.id} value={person.id}>{person.fullName}</option>)}</SelectField>
      <SelectField label="Руководитель работ *" disabled={dialog.mode === 'view' || !values.baseId} value={values.supervisorEmployeeId} onChange={(event) => setValues((current) => ({ ...current, supervisorEmployeeId: event.target.value }))}><option value="">Выберите руководителя</option>{employees.map((person) => <option key={person.id} value={person.id}>{person.fullName}</option>)}</SelectField>
      <SelectField label="Участники работ *" multiple size={6} disabled={dialog.mode === 'view' || !values.baseId} value={values.employeeIds} onChange={(event) => setValues((current) => ({ ...current, employeeIds: Array.from(event.target.selectedOptions, (option) => option.value) }))}>{employees.map((person) => <option key={person.id} value={person.id}>{person.fullName}</option>)}</SelectField>
      <TextArea label="Комментарий" disabled={dialog.mode === 'view'} value={values.description} onChange={(event) => setValues((current) => ({ ...current, description: event.target.value }))} rows={3} />
      {rowBeingEdited && <div className="row wrap"><strong>Статус: {rowBeingEdited.status.name}</strong>{canEditRow(rowBeingEdited) && availableTransitions.map((transition) => <button key={transition.code} type="button" className={transition.code === 'CANCELLED' ? 'btn btn-danger' : 'btn'} disabled={updateStatus.pending} onClick={() => updateStatus.run(transition.code)}>{transition.label}</button>)}</div>}
      {Boolean(save.error) && <Alert>{String(save.error)}</Alert>}
    </Dialog>}
  </>;
}
