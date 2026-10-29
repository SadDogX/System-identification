import { useMemo, useState } from 'react';
import { DEFAULT_TEMP_PASSWORD, type PositionDto } from '@app/shared';
import { api } from '../../core/api.ts';
import { invalidate, useAction, useQuery } from '../../core/data.ts';
import { Alert, Dialog, PageHeader, SelectField, TextField } from '@app/shared/ui';
import { Link } from '../../core/router.tsx';
import { ActionError } from '../../widgets/feedback/ActionError';

type Track = 'TRS' | 'R_AND_M';
interface Base { id: number; name: string; code: string | null }
interface Employee { id: number; user: { id: number; fullName: string; login: string; phone: string | null; email: string | null; systemRoles: { systemRole: { code: string } }[] }; assignments: { baseId: number | null; track: Track | 'UNASSIGNED'; position: { name: string } | null }[] }
interface CreatedUser { id: number }
interface EmployeeIdentity { id: number }

const FIELD_ROLES = [{ code: 'EMPLOYEE', label: 'Полевой сотрудник' }, { code: 'COORDINATOR', label: 'Координатор' }];
const SHOP_ROLES = [{ code: 'SHOP_EMPLOYEE', label: 'Цеховой сотрудник' }, { code: 'MECHANIC', label: 'Механик' }, { code: 'SHOP_FOREMAN', label: 'Мастер цеха' }];

type PersonnelMode = 'directory' | 'create';

/** Справочник персонала или отдельный сценарий создания сотрудника. */
export function PersonnelPage({ mode }: { mode: PersonnelMode }) {
  const basesQuery = useQuery('org:bases', () => api.get<Base[]>('/org/bases'));
  const positionsQuery = useQuery('org:personnel:positions', () => api.get<PositionDto[]>('/admin/positions'));
  const employeesQuery = useQuery('org:employees', () => api.get<Employee[]>('/org/employees'));
  const [track, setTrack] = useState<Track>('TRS');
  const [role, setRole] = useState('EMPLOYEE');
  const [baseId, setBaseId] = useState('');
  const [positionId, setPositionId] = useState('');
  const [supervisorId, setSupervisorId] = useState('');
  const [startsAt, setStartsAt] = useState(new Date().toISOString().slice(0, 10));
  const [fullName, setFullName] = useState('');
  const [login, setLogin] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [feedback, setFeedback] = useState('');
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [editValues, setEditValues] = useState({ fullName: '', phone: '', email: '' });
  const showForm = mode === 'create';
  const roles = track === 'TRS' ? FIELD_ROLES : SHOP_ROLES;
  const positions = positionsQuery.data ?? [];
  const visiblePositions = useMemo(() => positions.filter((item) => {
    const name = item.name.toLocaleLowerCase('ru');
    return track === 'TRS'
      ? /техник|инженер|руководитель группы|координатор/.test(name)
      : /слесарь|механик|мастер/.test(name);
  }), [positions, track]);
  const employees = employeesQuery.data ?? [];
  const requiredSupervisor = role === 'COORDINATOR' ? 'MANAGER' : role === 'EMPLOYEE' ? 'COORDINATOR' : role === 'SHOP_EMPLOYEE' ? 'SHOP_FOREMAN' : role === 'MECHANIC' ? 'SENIOR_MECHANIC' : '';
  const supervisors = employees.filter((item) => item.user.systemRoles.some((grant) => grant.systemRole.code === requiredSupervisor) && (!baseId || item.assignments[0]?.baseId === Number(baseId)));
  
  const create = useAction(async () => {
    const assignedSupervisorId = supervisorId || (supervisors.length === 1 ? String(supervisors[0].id) : '');
    if (!fullName.trim() || !login.trim() || !baseId || !positionId || (requiredSupervisor && !assignedSupervisorId)) throw new Error('Заполните карточку и назначение');
    const created = await api.post<CreatedUser>('/admin/users', { fullName: fullName.trim(), login: login.trim(), password: DEFAULT_TEMP_PASSWORD, role: 'USER', positionId: Number(positionId), phone: phone || null, email: email || null });
    const employee = await api.get<EmployeeIdentity>(`/org/users/${created.id}/employee`);
    await api.put(`/admin/org/users/${created.id}/roles`, { roles: [role] });
    await api.post(`/org/employees/${employee.id}/assignments`, { track, baseId: Number(baseId), positionId: Number(positionId), supervisorEmployeeId: assignedSupervisorId ? Number(assignedSupervisorId) : null, startsAt });
  }, {
    onSuccess: () => {
      setFeedback('Сотрудник создан и назначен. Временный пароль: user12345.');
      setFullName(''); setLogin(''); setPhone(''); setEmail(''); setSupervisorId(''); setPositionId('');
      invalidate('org:'); invalidate('admin:');
    }
  });
  const saveEmployee = useAction((employee: Employee) => api.patch(`/org/employees/${employee.id}/profile`, {
    fullName: editValues.fullName,
    phone: editValues.phone,
    email: editValues.email,
  }), {
    onSuccess: () => {
      setEditingEmployee(null);
      invalidate('org:employees');
    },
  });
  const edit = (employee: Employee) => {
    setEditingEmployee(employee);
    setEditValues({ fullName: employee.user.fullName, phone: employee.user.phone ?? '', email: employee.user.email ?? '' });
    saveEmployee.reset();
  };

  return <>
    <PageHeader
      title={showForm ? 'Добавление сотрудника' : 'Персонал БПО'}
      subtitle={showForm ? 'Создание учётной записи с должностью и организационным назначением' : 'Справочник сотрудников и их текущие назначения'}
      actions={showForm
        ? <Link to="/admin/org/personnel" className="btn">К справочнику персонала</Link>
        : <Link to="/admin/dictionaries/employees" className="btn btn-primary">Добавить сотрудника</Link>} />
    {feedback && <Alert kind="success">{feedback}</Alert>}
    {(basesQuery.error || positionsQuery.error || employeesQuery.error) && <Alert>{basesQuery.error ?? positionsQuery.error ?? employeesQuery.error}</Alert>}
    {showForm ? <form className="panel pad-lg stack" style={{ maxWidth: 900 }} onSubmit={(event) => { event.preventDefault(); setFeedback(''); create.run(); }}>
      <h2 className="section-title">Учётная запись</h2>
      <div className="form-grid"><TextField label="ФИО *" value={fullName} onChange={(event) => setFullName(event.target.value)} /><TextField label="Логин *" value={login} onChange={(event) => setLogin(event.target.value)} /></div>
      <p className="muted small">Временный пароль: user12345. При первом входе сотрудник задаст новый.</p>
      <div className="form-grid"><TextField label="Телефон" value={phone} onChange={(event) => setPhone(event.target.value)} /><TextField label="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></div>
      <h2 className="section-title">Тип персонала и должность</h2>
      <div className="form-grid">
        <SelectField label="Направление" value={track} onChange={(event) => { const next = event.target.value as Track; setTrack(next); setRole(next === 'TRS' ? 'EMPLOYEE' : 'SHOP_EMPLOYEE'); setPositionId(''); setSupervisorId(''); }}><option value="TRS">Полевой персонал</option><option value="R_AND_M">Цеховой персонал R&amp;M</option></SelectField>
        <SelectField label="Роль по должности" value={role} onChange={(event) => { setRole(event.target.value); setSupervisorId(''); }}>{roles.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}</SelectField>
        <SelectField label="Должность *" value={positionId} onChange={(event) => setPositionId(event.target.value)}><option value="">Выберите должность</option>{visiblePositions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</SelectField>
      </div>
      <h2 className="section-title">Организационное назначение</h2>
      <div className="form-grid">
        <SelectField label="База *" value={baseId} onChange={(event) => { setBaseId(event.target.value); setSupervisorId(''); }}><option value="">Выберите базу</option>{(basesQuery.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</SelectField>
        {requiredSupervisor && <SelectField label="Непосредственный руководитель *" value={supervisorId || (supervisors.length === 1 ? String(supervisors[0].id) : '')} onChange={(event) => setSupervisorId(event.target.value)}><option value="">Выберите руководителя</option>{supervisors.map((item) => <option key={item.id} value={item.id}>{item.user.fullName}</option>)}</SelectField>}
        <TextField label="Дата начала назначения *" type="date" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} />
      </div>
      <ActionError error={create.error} />
      <button className="btn btn-primary" disabled={create.pending}>{create.pending ? 'Создание…' : 'Создать сотрудника'}</button>
    </form> : <div className="panel table-wrap"><table className="table"><thead><tr><th>Сотрудник</th><th>Тип</th><th>Должность</th><th>База</th><th>Роль</th></tr></thead><tbody>{employees.map((item) => { const assignment = item.assignments[0]; return <tr key={item.id} className="clickable" role="button" tabIndex={0} onClick={() => edit(item)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); edit(item); } }}><td>{item.user.fullName}<div className="muted small">{item.user.login}</div></td><td>{assignment?.track === 'R_AND_M' ? 'Цеховой' : assignment?.track === 'TRS' ? 'Полевой' : 'Не назначен'}</td><td>{assignment?.position?.name ?? '—'}</td><td>{basesQuery.data?.find((base) => base.id === assignment?.baseId)?.name ?? '—'}</td><td>{item.user.systemRoles.map((grant) => grant.systemRole.code).join(', ')}</td></tr>; })}</tbody></table></div>}
    <Dialog
      open={!!editingEmployee}
      title="Редактирование сотрудника"
      onClose={() => setEditingEmployee(null)}
      onSubmit={() => editingEmployee && saveEmployee.run(editingEmployee)}
      actions={<><button type="button" className="btn" onClick={() => setEditingEmployee(null)}>Отмена</button><button type="submit" className="btn btn-primary" disabled={saveEmployee.pending}>Сохранить</button></>}
    >
      <TextField label="ФИО *" value={editValues.fullName} onChange={(event) => setEditValues((current) => ({ ...current, fullName: event.target.value }))} />
      <TextField label="Телефон" value={editValues.phone} onChange={(event) => setEditValues((current) => ({ ...current, phone: event.target.value }))} />
      <TextField label="Email" type="email" value={editValues.email} onChange={(event) => setEditValues((current) => ({ ...current, email: event.target.value }))} />
      <ActionError error={saveEmployee.error} />
    </Dialog>
  </>;
}
