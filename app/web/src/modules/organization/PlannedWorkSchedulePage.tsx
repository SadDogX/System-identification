import { useMemo, useState } from 'react';
import { api } from '../../core/api.ts';
import { useCurrentUser } from '../../core/auth.tsx';
import { invalidate, useAction, useQuery } from '../../core/data.ts';
import { Alert, Dialog, PageHeader, SelectField, TextField } from '@app/shared/ui';
import { PLANNED_WORK_COLORS, getYearDays } from '../../widgets/schedule/plannedWorkPresentation.ts';

interface Named { id: number; name: string }
interface Mine extends Named { baseId: number; base: Named }
interface Well extends Named { clusterNumber: string | null }
interface Person { id: number; fullName: string; baseIds: number[]; mineIds?: number[] }
interface Options { mines: Mine[]; coordinators: Person[]; employees: Person[]; selfEmployeeId: number | null }
interface Segment { startsAt: string; endsAt: string; conflict: boolean }
interface WorkRow {
  id: number; baseId: number; mineId: number; clusterNumber: string; wellId: number; name: string; startsAt: string; endsAt: string;
  coordinatorEmployeeId: number; supervisorEmployeeId: number; mine: Mine; well: Named;
  coordinator: { id: number; user: Named }; supervisor: { id: number; user: Named };
  employees: { employee: { id: number; user: Named } }[]; segments: Segment[]; conflictDates: string[];
}

type DialogMode = 'create' | 'view' | 'edit';
const currentYear = new Date().getFullYear();
const years = Array.from({ length: 6 }, (_, index) => currentYear - index);
const today = () => new Date().toISOString().slice(0, 10);
const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
const emptyValues = () => ({ name: '', mineId: '', clusterNumber: '', wellId: '', startsAt: today(), endsAt: today(), coordinatorEmployeeId: '', supervisorEmployeeId: '', employeeIds: [] as string[] });

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
  const canEditRow = (row: WorkRow) => isAdmin || user.systemRoles.includes('MANAGER') || (user.systemRoles.includes('COORDINATOR') && row.coordinatorEmployeeId === currentEmployeeId);
  const mines = options.data?.mines ?? [];
  const selectedMine = mines.find((mine) => String(mine.id) === values.mineId);
  const wellsQuery = useQuery(selectedMine ? `planned-work:wells:${selectedMine.id}` : null, () => api.get<Well[]>(`/org/mines/${selectedMine!.id}/wells`));
  const wells = (wellsQuery.data ?? []).filter((well) => well.clusterNumber === values.clusterNumber);
  const coordinators = (options.data?.coordinators ?? []).filter((person) => selectedMine && person.baseIds.includes(selectedMine.baseId) && person.mineIds?.includes(selectedMine.id));
  const employees = (options.data?.employees ?? []).filter((person) => selectedMine && person.baseIds.includes(selectedMine.baseId));
  const rows = schedule.data?.rows ?? [];
  const padGroups = useMemo(() => {
    const grouped = new Map<string, { mine: Mine; clusterNumber: string; rows: WorkRow[] }>();
    for (const row of rows) {
      const key = `${row.mineId}:${row.clusterNumber}`;
      const group = grouped.get(key) ?? { mine: row.mine, clusterNumber: row.clusterNumber, rows: [] };
      group.rows.push(row);
      grouped.set(key, group);
    }
    return [...grouped.values()];
  }, [rows]);
  const days = useMemo(() => getYearDays(year), [year]);
  const monthDays = useMemo(() => Array.from({ length: 12 }, (_, month) => days.filter((day) => Number(day.slice(5, 7)) === month + 1)), [days]);

  const resetForMine = (mineId: string) => setValues((current) => ({ ...current, mineId, clusterNumber: '', wellId: '', coordinatorEmployeeId: '', supervisorEmployeeId: '', employeeIds: [] }));
  const save = useAction(async () => {
    if (!values.name.trim() || !selectedMine || !values.clusterNumber || !values.wellId || !values.coordinatorEmployeeId || !values.supervisorEmployeeId || values.employeeIds.length === 0 || values.endsAt < values.startsAt) throw new Error('Fill all required fields and verify the date range.');
    const payload = { name: values.name.trim(), mineId: Number(values.mineId), clusterNumber: values.clusterNumber, wellId: Number(values.wellId), startsAt: values.startsAt, endsAt: values.endsAt, coordinatorEmployeeId: Number(values.coordinatorEmployeeId), supervisorEmployeeId: Number(values.supervisorEmployeeId), employeeIds: values.employeeIds.map(Number) };
    if (dialog?.mode === 'edit' && dialog.id) await api.put(`/planned-work/${dialog.id}`, payload);
    else await api.post('/planned-work', payload);
  }, { onSuccess: () => { setDialog(null); invalidate('planned-work:'); } });
  const remove = useAction((id: number) => api.delete(`/planned-work/${id}`), { onSuccess: () => invalidate('planned-work:') });

  const openCreate = () => {
    const next = emptyValues();
    if (mines.length === 1) next.mineId = String(mines[0].id);
    if (!isAdmin && options.data?.selfEmployeeId) next.coordinatorEmployeeId = String(options.data.selfEmployeeId);
    setValues(next);
    setDialog({ mode: 'create' });
  };
  const openExisting = async (id: number, mode: 'view' | 'edit') => {
    const row = await api.get<WorkRow>(`/planned-work/${id}`);
    setValues({ name: row.name, mineId: String(row.mineId), clusterNumber: row.clusterNumber, wellId: String(row.wellId), startsAt: row.startsAt, endsAt: row.endsAt, coordinatorEmployeeId: String(row.coordinatorEmployeeId), supervisorEmployeeId: String(row.supervisorEmployeeId), employeeIds: row.employees.map((item) => String(item.employee.id)) });
    setDialog({ mode, id });
  };
  const spanRow = (row: WorkRow) => {
    const cells = [];
    let cursor = 0;
    while (cursor < days.length) {
      const day = days[cursor];
      const segment = row.segments.find((item) => day >= item.startsAt && day <= item.endsAt);
      if (!segment) {
        cells.push(<td key={day} className="planned-work-empty" aria-label={`${row.clusterNumber}, ${day}`} />);
        cursor += 1;
        continue;
      }
      const span = daysBetween(day, segment.endsAt) + 1;
      cells.push(<td key={`${row.id}-${day}`} colSpan={span} className="planned-work-segment" style={{ background: segment.conflict ? PLANNED_WORK_COLORS.conflict : PLANNED_WORK_COLORS.normal }} title={`${row.name}: ${segment.startsAt} – ${segment.endsAt}${segment.conflict ? ' · conflict' : ''}`}><button type="button" onClick={(event) => { event.stopPropagation(); void openExisting(row.id, canEditRow(row) ? 'edit' : 'view'); }}>{row.well?.name ?? row.name}</button></td>);
      cursor += span;
    }
    return cells;
  };

  return <>
    <PageHeader title="План работ" subtitle="Календарный план по кустам с индикацией пересечений" actions={canManage ? <button type="button" className="btn btn-primary" onClick={openCreate}>Запланировать работу</button> : undefined} />
    {schedule.error && <Alert>{schedule.error}</Alert>}{options.error && <Alert>{options.error}</Alert>}{remove.error && <Alert>{String(remove.error)}</Alert>}
    <section className="panel pad row wrap planned-work-controls"><SelectField label="Год" value={String(year)} onChange={(event) => setYear(Number(event.target.value))}>{years.map((value) => <option key={value} value={value}>{value}</option>)}</SelectField><div className="schedule-legend" aria-label="Conflict legend"><span className="schedule-legend-item"><i style={{ background: PLANNED_WORK_COLORS.normal }} />Без конфликта</span><span className="schedule-legend-item"><i style={{ background: PLANNED_WORK_COLORS.conflict }} />Пересечение с другим кустом</span></div></section>
    <div className="annual-schedule-scroll-host planned-work-scroll-host"><div className="annual-schedule-wrap planned-work-scroll"><table className="annual-schedule planned-work-table">
      <thead><tr><th className="annual-name" rowSpan={3}>Площадка / куст</th><th className="planned-work-work-name" rowSpan={3}>Работа</th>{monthDays.map((month, index) => <th className={`annual-month month-${index % 2}`} key={index} colSpan={month.length}>{new Intl.DateTimeFormat('ru-RU', { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(year, index, 1)))}</th>)}</tr><tr>{days.map((date) => <th key={`weekday-${date}`} className="annual-day-head">{new Intl.DateTimeFormat('ru-RU', { weekday: 'short', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`))}</th>)}</tr><tr>{days.map((date) => <th key={date} className="annual-day-head">{Number(date.slice(8, 10))}</th>)}</tr></thead>
      <tbody>{padGroups.flatMap((group) => group.rows.map((row, index) => <tr key={row.id} className="planned-work-row" onClick={() => void openExisting(row.id, canEditRow(row) ? 'edit' : 'view')}>
        {index === 0 && <th className="annual-name planned-work-name" rowSpan={group.rows.length}>{group.mine.name} · {group.clusterNumber}</th>}
        <th className="planned-work-work-name">{row.name}</th>
        {spanRow(row)}
      </tr>))}</tbody>
    </table></div></div>
    {dialog && <Dialog open title={dialog.mode === 'view' ? 'Плановая работа' : dialog.mode === 'edit' ? 'Изменить плановую работу' : 'Новая плановая работа'} onClose={() => setDialog(null)} onSubmit={dialog.mode === 'view' ? undefined : () => save.run()} actions={<><button type="button" className="btn" onClick={() => setDialog(null)}>Закрыть</button>{dialog.mode !== 'view' && <button type="submit" className="btn btn-primary" disabled={save.pending || !values.name.trim() || !values.mineId || !values.clusterNumber || !values.wellId || !values.coordinatorEmployeeId || !values.supervisorEmployeeId || !values.employeeIds.length || values.endsAt < values.startsAt}>Сохранить</button>}{dialog.mode === 'edit' && dialog.id && canEditRow(rows.find((row) => row.id === dialog.id)!) && <button type="button" className="btn btn-danger" disabled={remove.pending} onClick={() => remove.run(dialog.id!)}>Удалить</button>}</>}>
      <TextField label="Наименование *" disabled={dialog.mode === 'view'} value={values.name} onChange={(event) => setValues((current) => ({ ...current, name: event.target.value }))} />
      <SelectField label="База *" disabled value={String(selectedMine?.baseId ?? '')}><option value="">{selectedMine?.base.name ?? 'Определится по месторождению'}</option></SelectField>
      <SelectField label="Месторождение / поле *" disabled={dialog.mode === 'view'} value={values.mineId} onChange={(event) => resetForMine(event.target.value)}><option value="">Выберите поле</option>{mines.map((mine) => <option key={mine.id} value={mine.id}>{mine.base.name} · {mine.name}</option>)}</SelectField>
      <SelectField label="Куст / pad *" disabled={dialog.mode === 'view' || !selectedMine} value={values.clusterNumber} onChange={(event) => setValues((current) => ({ ...current, clusterNumber: event.target.value, wellId: '' }))}><option value="">Выберите куст</option>{[...new Set((wellsQuery.data ?? []).map((well) => well.clusterNumber).filter((value): value is string => !!value))].map((cluster) => <option key={cluster} value={cluster}>{cluster}</option>)}</SelectField>
      <SelectField label="Скважина *" disabled={dialog.mode === 'view' || !values.clusterNumber} value={values.wellId} onChange={(event) => setValues((current) => ({ ...current, wellId: event.target.value }))}><option value="">Выберите скважину</option>{wells.map((well) => <option key={well.id} value={well.id}>{well.name}</option>)}</SelectField>
      <div className="form-grid"><TextField label="Начало *" type="date" disabled={dialog.mode === 'view'} value={values.startsAt} onChange={(event) => setValues((current) => ({ ...current, startsAt: event.target.value }))} /><TextField label="Окончание *" type="date" min={values.startsAt} disabled={dialog.mode === 'view'} value={values.endsAt} onChange={(event) => setValues((current) => ({ ...current, endsAt: event.target.value }))} /></div>
      <SelectField label="Координатор *" disabled={dialog.mode === 'view' || !selectedMine} value={values.coordinatorEmployeeId} onChange={(event) => setValues((current) => ({ ...current, coordinatorEmployeeId: event.target.value }))}><option value="">Выберите координатора</option>{coordinators.map((person) => <option key={person.id} value={person.id}>{person.fullName}</option>)}</SelectField>
      <SelectField label="Руководитель работ *" disabled={dialog.mode === 'view' || !selectedMine} value={values.supervisorEmployeeId} onChange={(event) => setValues((current) => ({ ...current, supervisorEmployeeId: event.target.value }))}><option value="">Выберите руководителя</option>{employees.map((person) => <option key={person.id} value={person.id}>{person.fullName}</option>)}</SelectField>
      <SelectField label="Участники работ *" multiple size={6} disabled={dialog.mode === 'view' || !selectedMine} value={values.employeeIds} onChange={(event) => setValues((current) => ({ ...current, employeeIds: Array.from(event.target.selectedOptions, (option) => option.value) }))}>{employees.map((person) => <option key={person.id} value={person.id}>{person.fullName}</option>)}</SelectField>
      {Boolean(save.error) && <Alert>{String(save.error)}</Alert>}
    </Dialog>}
  </>;
}
