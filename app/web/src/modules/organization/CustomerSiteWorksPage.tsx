import { useMemo, useState } from 'react';
import { api } from '../../core/api.ts';
import { useCurrentUser } from '../../core/auth.tsx';
import { invalidate, useAction, useQuery } from '../../core/data.ts';
import { Alert, Dialog, PageHeader, SelectField, TextField } from '@app/shared/ui';
import { ActionError } from '../../widgets/feedback/ActionError';
import { CUSTOMER_SITE_WORK_COLORS, type CustomerSiteWorkStatus } from '../../widgets/schedule/schedulePresentation';

type Status = CustomerSiteWorkStatus;
interface Named { id: number; name: string }
interface Mine extends Named { base: Named }
interface Well extends Named { clusterNumber: string | null }
interface Supervisor { id: number; user: { fullName: string } }
interface WorkOptions { customers: Named[]; mines: Mine[]; supervisors: Supervisor[] }
interface CustomerSiteWork {
  id: number; name: string; startsAt: string; expectedEndAt: string; clusterNumber: string; status: Status; hasOverlap: boolean;
  customer: Named; mine: Mine; well: Well; supervisor: Supervisor;
}
interface WorkExecution {
  id: number; performedAt: string; workType: { name: string }; status: { name: string }; contract: { number: string };
  addendum: { number: string } | null; description: string | null; responsible: string[];
}

const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const dateLabel = (date: string) => date.slice(0, 10).split('-').reverse().join('.');

export function CustomerSiteWorksPage() {
  const user = useCurrentUser();
  const isAdmin = user.systemRoles.includes('ADMIN');
  const self = useQuery('org:site-work:self', () => api.get<{ user: { systemRoles: { systemRole: { code: string } }[] } }>(`/org/users/${user.id}/employee`));
  const roles = self.data?.user.systemRoles.map((role) => role.systemRole.code) ?? user.systemRoles;
  const canView = isAdmin || roles.includes('COORDINATOR');
  const options = useQuery(canView ? 'org:customer-site-works:options' : null, () => api.get<WorkOptions>('/org/customer-site-works/options'));
  const works = useQuery(canView ? 'org:customer-site-works' : null, () => api.get<CustomerSiteWork[]>('/org/customer-site-works'));
  const team = useQuery(canView && !isAdmin ? 'org:customer-site-works:team' : null, () => api.get<Supervisor[]>('/org/customer-site-works/team'));
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [mineId, setMineId] = useState('');
  const [wellId, setWellId] = useState('');
  const [startsAt, setStartsAt] = useState(today());
  const [expectedEndAt, setExpectedEndAt] = useState(today());
  const [supervisorEmployeeId, setSupervisorEmployeeId] = useState('');
  const [message, setMessage] = useState('');
  const [selectedWork, setSelectedWork] = useState<CustomerSiteWork | null>(null);

  const mines = options.data?.mines ?? [];
  const executionHistory = useQuery(
    selectedWork ? `org:customer-site-works:executions:${selectedWork.id}` : null,
    () => api.get<WorkExecution[]>(`/org/customer-site-works/${selectedWork!.id}/executions`),
  );
  const wellsQuery = useQuery(mineId ? `org:customer-site-works:wells:${mineId}` : null, () => api.get<Well[]>(`/org/mines/${mineId}/wells`));
  const wells = useMemo(() => wellsQuery.data ?? [], [wellsQuery.data]);
  const clusters = [...new Set(wells.map((well) => well.clusterNumber).filter((cluster): cluster is string => !!cluster))];
  const selectedWell = wells.find((well) => String(well.id) === wellId);
  const supervisors = isAdmin ? options.data?.supervisors ?? [] : team.data ?? [];

  const create = useAction(() => api.post<CustomerSiteWork>('/org/customer-site-works', {
    name, customerId: Number(customerId), mineId: Number(mineId), wellId: Number(wellId), startsAt, expectedEndAt,
    supervisorEmployeeId: Number(supervisorEmployeeId),
  }), {
    onSuccess: (work) => {
      setMessage(work.hasOverlap ? 'Работа зарегистрирована; период пересекается с другой работой и отмечен красным.' : 'Работа зарегистрирована.');
      setOpen(false);
      setName(''); setCustomerId(''); setMineId(''); setWellId(''); setSupervisorEmployeeId('');
      invalidate('org:customer-site-works');
    },
  });

  const firstError = self.error || options.error || works.error || team.error || wellsQuery.error;

  return <>
    <PageHeader title="Работы на объектах заказчика" subtitle="Регистрация работ и расписание команды координатора"
      actions={canView ? <button type="button" className="btn btn-primary" onClick={() => { setMessage(''); setOpen(true); }}>Зарегистрировать работу</button> : undefined} />
    {firstError && <Alert>{firstError}</Alert>}
    {message && <Alert kind="info">{message}</Alert>}
    {!canView && <Alert kind="info">Регистрация работ доступна координатору и администратору.</Alert>}
    {canView && <>
      <div className="schedule-legend site-work-legend">
        {(Object.keys(CUSTOMER_SITE_WORK_COLORS) as Status[]).map((status) => <span className="schedule-legend-item" key={status}><i style={{ background: CUSTOMER_SITE_WORK_COLORS[status] }} />{status === 'PAST' ? 'Завершена' : status === 'UPCOMING' ? 'Предстоит' : status === 'ACTIVE' ? 'В работе' : 'Пересечение'}</span>)}
      </div>
      <section className="panel table-wrap customer-site-work-wrap">
        <table className="table customer-site-work-table">
          <thead><tr><th>Работа</th><th>Заказчик</th><th>Месторождение / база</th><th>Куст / скважина</th><th>Период</th><th>Руководитель</th><th>Состояние</th><th>Фактические работы</th></tr></thead>
          <tbody>{works.data?.map((work) => <tr key={work.id} className={work.hasOverlap ? 'site-work-overlap' : ''}>
            <td>{work.name}</td><td>{work.customer.name}</td><td>{work.mine.name}<div className="muted small">{work.mine.base.name}</div></td>
            <td>{work.clusterNumber} / {work.well.name}</td><td>{dateLabel(work.startsAt)} – {dateLabel(work.expectedEndAt)}</td><td>{work.supervisor.user.fullName}</td>
            <td><span className="site-work-status" style={{ background: CUSTOMER_SITE_WORK_COLORS[work.status] }}>{work.hasOverlap ? 'Пересечение' : work.status === 'PAST' ? 'Завершена' : work.status === 'UPCOMING' ? 'Предстоит' : 'В работе'}</span></td>
            <td><button type="button" className="btn btn-sm" onClick={() => setSelectedWork(work)}>Журнал</button></td>
          </tr>)}</tbody>
        </table>
        {works.data?.length === 0 && <div className="empty">Работы пока не зарегистрированы.</div>}
      </section>
      <Dialog
        open={!!selectedWork}
        wide
        title={`Фактические работы${selectedWork ? ` · ${selectedWork.name}` : ''}`}
        onClose={() => setSelectedWork(null)}
        actions={<button type="button" className="btn" onClick={() => setSelectedWork(null)}>Закрыть</button>}
      >
        {executionHistory.error && <Alert>{executionHistory.error}</Alert>}
        {executionHistory.data && executionHistory.data.length > 0
          ? <div className="table-wrap"><table className="table">
            <thead><tr><th>Дата</th><th>Вид работ</th><th>Статус</th><th>Договор</th><th>Ответственные</th><th>Описание</th></tr></thead>
            <tbody>{executionHistory.data.map((execution) => <tr key={execution.id}>
              <td>{dateLabel(execution.performedAt)}</td>
              <td>{execution.workType.name}</td>
              <td>{execution.status.name}</td>
              <td>{execution.contract.number}{execution.addendum ? ` · ${execution.addendum.number}` : ''}</td>
              <td>{execution.responsible.join(', ') || '—'}</td>
              <td>{execution.description || '—'}</td>
            </tr>)}</tbody>
          </table></div>
          : executionHistory.data && <p className="muted">Фактические работы пока не зарегистрированы.</p>}
      </Dialog>
      <Dialog open={open} wide title="Регистрация работы на объекте заказчика" onClose={() => setOpen(false)} onSubmit={() => create.run()} actions={<><button type="button" className="btn" onClick={() => setOpen(false)}>Отмена</button><button type="submit" className="btn btn-primary" disabled={create.pending || !name.trim() || !customerId || !mineId || !selectedWell?.clusterNumber || !supervisorEmployeeId || expectedEndAt < startsAt}>{create.pending ? 'Сохранение…' : 'Зарегистрировать'}</button></>}>
        <TextField label="Наименование работы *" value={name} onChange={(event) => setName(event.target.value)} />
        <SelectField label="Заказчик *" value={customerId} onChange={(event) => setCustomerId(event.target.value)}><option value="">Выберите заказчика</option>{options.data?.customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</SelectField>
        <SelectField label="Месторождение *" value={mineId} onChange={(event) => { setMineId(event.target.value); setWellId(''); }}><option value="">Выберите месторождение</option>{mines.map((mine) => <option key={mine.id} value={mine.id}>{mine.name} · {mine.base.name}</option>)}</SelectField>
        <SelectField label="Куст *" value={selectedWell?.clusterNumber ?? ''} onChange={(event) => { const well = wells.find((item) => item.clusterNumber === event.target.value); setWellId(well ? String(well.id) : ''); }}><option value="">Выберите куст</option>{clusters.map((cluster) => <option key={cluster} value={cluster}>{cluster}</option>)}</SelectField>
        <SelectField label="Скважина *" value={wellId} onChange={(event) => setWellId(event.target.value)}><option value="">Выберите скважину</option>{wells.filter((well) => !selectedWell?.clusterNumber || well.clusterNumber === selectedWell.clusterNumber).map((well) => <option key={well.id} value={well.id}>{well.name}</option>)}</SelectField>
        <div className="form-grid"><TextField label="Дата начала *" type="date" required value={startsAt} onChange={(event) => setStartsAt(event.target.value)} /><TextField label="Ожидаемая дата окончания *" type="date" required min={startsAt} value={expectedEndAt} onChange={(event) => setExpectedEndAt(event.target.value)} /></div>
        <SelectField label="Руководитель работ *" value={supervisorEmployeeId} onChange={(event) => setSupervisorEmployeeId(event.target.value)}><option value="">Выберите руководителя</option>{supervisors.map((person) => <option key={person.id} value={person.id}>{person.user.fullName}</option>)}</SelectField>
        <ActionError error={create.error} />
      </Dialog>
    </>}
  </>;
}
