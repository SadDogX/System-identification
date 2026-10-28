import { useMemo, useState } from 'react';
import { DEFAULT_TEMP_PASSWORD, type PositionDto } from '@app/shared';
import { api, errorMessage } from '../../core/api.ts';
import { invalidate, useAction, useQuery } from '../../core/data.ts';
import { Alert, PageHeader, SelectField, TextField } from '@app/shared/ui';
import { Link } from '../../core/router.tsx';

type Track = 'TRS' | 'R_AND_M';
interface Base { id: number; name: string; code: string | null }
interface Employee { id: number; user: { fullName: string; login: string; systemRoles: { systemRole: { code: string } }[] }; assignments: { baseId: number | null; track: Track | 'UNASSIGNED'; position: { name: string } | null }[] }
interface CreatedUser { id: number }
interface EmployeeIdentity { id: number }

const FIELD_ROLES = [{ code: 'EMPLOYEE', label: 'Полевой сотрудник' }, { code: 'COORDINATOR', label: 'Координатор' }];
const SHOP_ROLES = [{ code: 'SHOP_EMPLOYEE', label: 'Цеховой сотрудник' }, { code: 'MECHANIC', label: 'Механик' }, { code: 'SHOP_FOREMAN', label: 'Мастер цеха' }];

/** Страница справочника персонала и полной формы добавления. Вход: карточка, назначение и роль; результат: созданный пользователь с оргназначением. */
export function PersonnelPage() {
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
  const [showForm, setShowForm] = useState(false);
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

  return <>
    <PageHeader
      title="Персонал БПО"
      subtitle="Справочник сотрудников и полная форма создания с назначением"
      actions={<Link to="/admin/org/assignments" className="btn">Назначения и распределение</Link>} />
    <div className="row wrap" style={{ marginBottom: 16 }}>
      <button className={`btn${!showForm ? ' btn-primary' : ''}`} onClick={() => setShowForm(false)}>Справочник персонала</button>
      <button className={`btn${showForm ? ' btn-primary' : ''}`} onClick={() => setShowForm(true)}>Добавить сотрудника</button>
      {/* <Link to="/admin/org/transfers" className="btn">Переводы</Link> */}
    </div>
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
      {Boolean(create.error) && <Alert>{errorMessage(create.error)}</Alert>}
      <button className="btn btn-primary" disabled={create.pending}>{create.pending ? 'Создание…' : 'Создать сотрудника'}</button>
    </form> : <div className="panel table-wrap"><table className="table"><thead><tr><th>Сотрудник</th><th>Тип</th><th>Должность</th><th>База</th><th>Роль</th></tr></thead><tbody>{employees.map((item) => { const assignment = item.assignments[0]; return <tr key={item.id}><td>{item.user.fullName}<div className="muted small">{item.user.login}</div></td><td>{assignment?.track === 'R_AND_M' ? 'Цеховой' : assignment?.track === 'TRS' ? 'Полевой' : 'Не назначен'}</td><td>{assignment?.position?.name ?? '—'}</td><td>{basesQuery.data?.find((base) => base.id === assignment?.baseId)?.name ?? '—'}</td><td>{item.user.systemRoles.map((grant) => grant.systemRole.code).join(', ')}</td></tr>; })}</tbody></table></div>}
  </>;
}
