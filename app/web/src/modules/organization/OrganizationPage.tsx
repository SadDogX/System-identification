import { useMemo, useState } from 'react';
import { api, errorMessage } from '../../core/api.ts';
import { useCurrentUser } from '../../core/auth.tsx';
import { invalidate, useAction, useQuery } from '../../core/data.ts';
import { Alert, Icon, PageHeader, SelectField, TextField } from '@app/shared/ui';

interface Base { id: number; name: string; code: string | null }
interface Position { id: number; name: string }
interface SystemRole { id: number; code: string; name: string; isActive: boolean }
interface Employee {
  id: number;
  user: {
    id: number;
    fullName: string;
    login: string;
    isActive: boolean;
    isDeleted: boolean;
    systemRoles: { systemRole: SystemRole }[];
  };
  assignments: {
    id: number;
    positionId: number | null;
    baseId: number | null;
    supervisorEmployeeId: number | null;
    track: 'TRS' | 'R_AND_M' | 'UNASSIGNED';
    startsAt: string;
    position: Position | null;
    base: Base | null;
    supervisor: { user: { fullName: string } } | null;
  }[];
}
interface Mine { id: number; name: string; code: string | null; baseId: number; base: Base }

const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const trackFor = (role: string) => (['SENIOR_MECHANIC', 'MECHANIC', 'SHOP_FOREMAN', 'SHOP_EMPLOYEE'].includes(role) ? 'R_AND_M' : 'TRS');

export function OrganizationPage() {
  const user = useCurrentUser();
  const isAdmin = user.role === 'ADMIN';
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [selectedBaseId, setSelectedBaseId] = useState('');
  const [selectedRole, setSelectedRole] = useState('EMPLOYEE');
  const [selectedPositionId, setSelectedPositionId] = useState('');
  const [selectedSupervisorId, setSelectedSupervisorId] = useState('');
  const [startsAt, setStartsAt] = useState(today());
  const [reason, setReason] = useState('');
  const [baseName, setBaseName] = useState('');
  const [baseCode, setBaseCode] = useState('');
  const [mineName, setMineName] = useState('');
  const [mineCode, setMineCode] = useState('');
  const [wellMineId, setWellMineId] = useState('');
  const [wellName, setWellName] = useState('');
  const [wellCode, setWellCode] = useState('');
  const [coordinatorByMine, setCoordinatorByMine] = useState<Record<number, string>>({});
  const [transferDateByMine, setTransferDateByMine] = useState<Record<number, string>>({});
  const [errorMessageText, setErrorMessageText] = useState('');

  const basesQuery = useQuery('org:bases', () => api.get<Base[]>('/org/bases'));
  const employeesQuery = useQuery('org:employees', () => api.get<Employee[]>('/org/employees'));
  const positionsQuery = useQuery('org:positions', () => api.get<Position[]>('/org/positions'));
  const rolesQuery = useQuery('org:roles', () => api.get<SystemRole[]>(isAdmin ? '/admin/org/roles' : '/org/roles'));
  const bases = basesQuery.data ?? [];
  const employees = employeesQuery.data ?? [];
  const positions = positionsQuery.data ?? [];
  const roles = (rolesQuery.data ?? []).filter((role) => role.isActive);
  const signedInEmployee = employees.find((employee) => employee.user.id === user.id);
  const signedInRoleCodes = signedInEmployee?.user.systemRoles.map((grant) => grant.systemRole.code) ?? [];
  const isManager = signedInRoleCodes.includes('MANAGER');
  const selectedEmployee = employees.find((employee) => String(employee.id) === selectedEmployeeId);
  const currentAssignment = selectedEmployee?.assignments[0];
  const roleForForm = isAdmin
    ? selectedRole
    : selectedEmployee?.user.systemRoles.find((grant) => grant.systemRole.code !== 'EMPLOYEE' && grant.systemRole.code !== 'ADMIN')?.systemRole.code ?? 'EMPLOYEE';
  const supervisorRole = roleForForm === 'COORDINATOR' ? 'MANAGER' : roleForForm === 'EMPLOYEE' ? 'COORDINATOR' : roleForForm === 'MECHANIC' ? 'SENIOR_MECHANIC' : roleForForm === 'SHOP_EMPLOYEE' ? 'SHOP_FOREMAN' : roleForForm === 'SHOP_FOREMAN' ? 'MECHANIC' : '';
  const supervisors = employees.filter((employee) => employee.user.systemRoles.some((grant) => grant.systemRole.code === supervisorRole));
  const minesQuery = useQuery('org:mines', () => api.get<Mine[]>('/org/mines'));
  const mines = minesQuery.data ?? [];
  const coordinators = employees.filter((employee) => employee.user.systemRoles.some((grant) => grant.systemRole.code === 'COORDINATOR'));

  const refresh = () => {
    invalidate('org:');
    invalidate('admin:');
  };

  const createBase = useAction(() => api.post('/admin/org/bases', { name: baseName, code: baseCode || null }), {
    onSuccess: () => {
      setBaseName('');
      setBaseCode('');
      refresh();
    },
  });
  const createMine = useAction((baseId: number) => api.post(`/org/bases/${baseId}/mines`, { name: mineName, code: mineCode || null }), {
    onSuccess: () => {
      setMineName('');
      setMineCode('');
      refresh();
    },
  });
  const createWell = useAction((mineId: number) => api.post(`/org/mines/${mineId}/wells`, { name: wellName, code: wellCode || null }), {
    onSuccess: () => {
      setWellName('');
      setWellCode('');
      refresh();
    },
  });
  const assignMineCoordinator = useAction((input: { mineId: number; coordinatorEmployeeId: number; startsAt: string }) =>
    api.post(`/org/mines/${input.mineId}/coordinator`, {
      coordinatorEmployeeId: input.coordinatorEmployeeId,
      startsAt: input.startsAt,
    }), {
      onSuccess: refresh,
    });
  const assignEmployee = useAction(async () => {
    if (!selectedEmployee) throw new Error('Выберите сотрудника');
    const roleCodes = isAdmin
      ? [selectedRole]
      : selectedEmployee.user.systemRoles.map((grant) => grant.systemRole.code);

    if (isAdmin) {
      await api.put(`/admin/org/users/${selectedEmployee.user.id}/roles`, { roles: roleCodes });
    }
    return api.post(`/org/employees/${selectedEmployee.id}/assignments`, {
      track: trackFor(roleForForm),
      baseId: selectedBaseId ? Number(selectedBaseId) : null,
      positionId: selectedPositionId ? Number(selectedPositionId) : null,
      supervisorEmployeeId: selectedSupervisorId ? Number(selectedSupervisorId) : null,
      startsAt,
      reason: reason || null,
    });
  }, {
    onSuccess: () => {
      setReason('');
      setErrorMessageText('');
      refresh();
    },
    onError: (error) => setErrorMessageText(errorMessage(error)),
  });

  const mineByBase = useMemo(() => {
    const grouped = new Map<number, Mine[]>();
    for (const mine of mines) grouped.set(mine.baseId, [...(grouped.get(mine.baseId) ?? []), mine]);
    return grouped;
  }, [mines]);

  return (
    <>
      <PageHeader
        title={isAdmin ? 'Организационная структура' : 'Моя база и команда'}
        subtitle="Базы, месторождения, сотрудники и назначения с сохранением истории переводов"
      />
      {(basesQuery.error || employeesQuery.error || positionsQuery.error || rolesQuery.error || minesQuery.error) && (
        <Alert>{basesQuery.error ?? employeesQuery.error ?? positionsQuery.error ?? rolesQuery.error ?? minesQuery.error}</Alert>
      )}
      {errorMessageText && <Alert>{errorMessageText}</Alert>}

      {isAdmin && (
        <section className="panel" style={{ padding: 18, marginBottom: 16 }}>
          <h2 className="section-title">Базы</h2>
          <div className="row wrap">
            {bases.map((base) => <span className="chip" key={base.id}>{base.name} · {base.code}</span>)}
          </div>
          <form className="row wrap" style={{ alignItems: 'flex-end', marginTop: 16 }} onSubmit={(event) => {
            event.preventDefault();
            createBase.run();
          }}>
            <TextField label="Название базы" value={baseName} onChange={(event) => setBaseName(event.target.value)} />
            <TextField label="Код" value={baseCode} onChange={(event) => setBaseCode(event.target.value)} />
            <button className="btn btn-primary" disabled={createBase.pending || !baseName.trim()}><Icon name="add" small /> Добавить базу</button>
          </form>
          {Boolean(createBase.error) && <Alert>{errorMessage(createBase.error)}</Alert>}
        </section>
      )}

      <section className="panel" style={{ padding: 18, marginBottom: 16 }}>
        <h2 className="section-title">{isAdmin ? 'Карточки сотрудников и назначения' : 'Сотрудники моей зоны ответственности'}</h2>
        {isAdmin && (
          <p className="muted">`root` назначается менеджеру базы, `editor` — координатору. Назначение сотрудника не меняет его старые кадровые записи.</p>
        )}
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Сотрудник</th><th>Системная роль</th><th>Должность</th><th>База / руководитель</th><th>Подразделение</th></tr></thead>
            <tbody>
              {employees.map((employee) => {
                const assignment = employee.assignments[0];
                return (
                  <tr key={employee.id} className={employee.user.isActive ? '' : 'dimmed'}>
                    <td>{employee.user.fullName}<div className="muted small">{employee.user.login}</div></td>
                    <td>{employee.user.systemRoles.map((grant) => grant.systemRole.name).join(', ') || 'Сотрудник'}</td>
                    <td>{assignment?.position?.name ?? 'Не назначена'}</td>
                    <td>{assignment?.base?.name ?? 'Не назначена'}{assignment?.supervisor?.user.fullName && <div className="muted small">Руководитель: {assignment.supervisor.user.fullName}</div>}</td>
                    <td>{assignment?.track === 'UNASSIGNED' ? 'Не назначено' : assignment?.track === 'R_AND_M' ? 'R&M' : 'TRS'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {employees.length === 0 && <div className="empty">Нет сотрудников в доступной области.</div>}
        </div>

        {(isAdmin || isManager) && (
          <form className="panel" style={{ padding: 16, marginTop: 18 }} onSubmit={async (event) => {
            event.preventDefault();
            setErrorMessageText('');
            await assignEmployee.run();
          }}>
            <h3 className="section-title">{isAdmin ? 'Назначить сотрудника' : 'Перевести сотрудника внутри своей базы'}</h3>
            <div className="row wrap">
              <SelectField label="Сотрудник" value={selectedEmployeeId} onChange={(event) => {
                setSelectedEmployeeId(event.target.value);
                const employee = employees.find((item) => String(item.id) === event.target.value);
                const assignment = employee?.assignments[0];
                setSelectedBaseId(assignment?.baseId ? String(assignment.baseId) : (bases[0] ? String(bases[0].id) : ''));
                setSelectedPositionId(assignment?.positionId ? String(assignment.positionId) : '');
                setSelectedSupervisorId(assignment?.supervisorEmployeeId ? String(assignment.supervisorEmployeeId) : '');
                if (isAdmin) setSelectedRole(employee?.user.systemRoles[0]?.systemRole.code ?? 'EMPLOYEE');
              }}>
                <option value="">Выберите сотрудника</option>
                {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.user.fullName} · {employee.user.login}</option>)}
              </SelectField>
              {isAdmin && <SelectField label="Роль" value={selectedRole} onChange={(event) => {
                setSelectedRole(event.target.value);
                setSelectedSupervisorId('');
              }}>
                {roles.filter((role) => role.code !== 'ADMIN').map((role) => <option key={role.code} value={role.code}>{role.name}</option>)}
              </SelectField>}
              <SelectField label="База" value={selectedBaseId} onChange={(event) => setSelectedBaseId(event.target.value)}>
                <option value="">Не назначена</option>
                {bases.map((base) => <option key={base.id} value={base.id}>{base.name} ({base.code})</option>)}
              </SelectField>
              <SelectField label="Должность" value={selectedPositionId} onChange={(event) => setSelectedPositionId(event.target.value)}>
                <option value="">Не указана</option>
                {positions.map((position) => <option key={position.id} value={position.id}>{position.name}</option>)}
              </SelectField>
              {supervisorRole && <SelectField label="Непосредственный руководитель" value={selectedSupervisorId} onChange={(event) => setSelectedSupervisorId(event.target.value)}>
                <option value="">Выберите руководителя</option>
                {supervisors.map((employee) => <option key={employee.id} value={employee.id}>{employee.user.fullName}</option>)}
              </SelectField>}
              <TextField label="Дата начала" type="date" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} />
              <TextField label="Причина перевода" value={reason} onChange={(event) => setReason(event.target.value)} />
              <button
                className="btn btn-primary"
                disabled={
                  assignEmployee.pending ||
                  !selectedEmployeeId ||
                  !startsAt ||
                  (roleForForm !== 'SENIOR_MECHANIC' && !selectedBaseId) ||
                  (!!supervisorRole && !selectedSupervisorId)
                }
              >
                <Icon name="doneAll" small /> Сохранить назначение
              </button>
            </div>
            {Boolean(assignEmployee.error) && <Alert>{errorMessage(assignEmployee.error)}</Alert>}
          </form>
        )}
      </section>

      <section className="panel" style={{ padding: 18 }}>
        <h2 className="section-title">Месторождения</h2>
        {Array.from(mineByBase.entries()).map(([baseId, baseMines]) => {
          const base = bases.find((item) => item.id === baseId);
          return <div key={baseId} style={{ marginBottom: 20 }}>
            <h3>{base?.name ?? baseMines[0]?.base.name}</h3>
            {baseMines.map((mine) => <MineRow
              key={mine.id}
              mine={mine}
              canManage={isAdmin || isManager}
              coordinators={coordinators}
              selectedCoordinatorId={coordinatorByMine[mine.id] ?? ''}
              startsAt={transferDateByMine[mine.id] ?? today()}
              onCoordinatorChange={(value) => setCoordinatorByMine((state) => ({ ...state, [mine.id]: value }))}
              onDateChange={(value) => setTransferDateByMine((state) => ({ ...state, [mine.id]: value }))}
              onAssign={async () => {
                await assignMineCoordinator.run({
                  mineId: mine.id,
                  coordinatorEmployeeId: Number(coordinatorByMine[mine.id]),
                  startsAt: transferDateByMine[mine.id] ?? today(),
                });
              }}
              pending={assignMineCoordinator.pending}
            />)}
          </div>;
        })}
        {mines.length === 0 && <div className="empty">Месторождения пока не созданы или не назначены вашей роли.</div>}
        {(isAdmin || isManager) && (
          <form className="row wrap" style={{ alignItems: 'flex-end', marginTop: 18 }} onSubmit={(event) => {
            event.preventDefault();
            const baseId = isAdmin ? Number(selectedBaseId) : signedInEmployee?.assignments[0]?.baseId;
            if (baseId) createMine.run(baseId);
          }}>
            {isAdmin && <SelectField label="База" value={selectedBaseId} onChange={(event) => setSelectedBaseId(event.target.value)}>
              <option value="">Выберите базу</option>
              {bases.map((base) => <option key={base.id} value={base.id}>{base.name}</option>)}
            </SelectField>}
            <TextField label="Новое месторождение" value={mineName} onChange={(event) => setMineName(event.target.value)} />
            <TextField label="Код" value={mineCode} onChange={(event) => setMineCode(event.target.value)} />
            <button className="btn btn-primary" disabled={createMine.pending || !mineName.trim() || (isAdmin && !selectedBaseId)}><Icon name="add" small /> Добавить</button>
          </form>
        )}
        {Boolean(createMine.error) && <Alert>{errorMessage(createMine.error)}</Alert>}
        {(isAdmin || isManager) && <form className="row wrap" style={{ alignItems: 'flex-end', marginTop: 18 }} onSubmit={(event) => {
          event.preventDefault();
          if (wellMineId) createWell.run(Number(wellMineId));
        }}>
          <SelectField label="Месторождение" value={wellMineId} onChange={(event) => setWellMineId(event.target.value)}>
            <option value="">Выберите месторождение</option>
            {mines.map((mine) => <option key={mine.id} value={mine.id}>{mine.base.name} · {mine.name}</option>)}
          </SelectField>
          <TextField label="Новая скважина" value={wellName} onChange={(event) => setWellName(event.target.value)} />
          <TextField label="Код" value={wellCode} onChange={(event) => setWellCode(event.target.value)} />
          <button className="btn btn-primary" disabled={createWell.pending || !wellMineId || !wellName.trim()}><Icon name="add" small /> Добавить скважину</button>
        </form>}
        {Boolean(createWell.error) && <Alert>{errorMessage(createWell.error)}</Alert>}
      </section>
    </>
  );
}

function MineRow({
  mine,
  canManage,
  coordinators,
  selectedCoordinatorId,
  startsAt,
  onCoordinatorChange,
  onDateChange,
  onAssign,
  pending,
}: {
  mine: Mine;
  canManage: boolean;
  coordinators: Employee[];
  selectedCoordinatorId: string;
  startsAt: string;
  onCoordinatorChange: (value: string) => void;
  onDateChange: (value: string) => void;
  onAssign: () => void;
  pending: boolean;
}) {
  const wellsQuery = useQuery(`org:wells:${mine.id}`, () => api.get<{ id: number; name: string; code: string | null }[]>(`/org/mines/${mine.id}/wells`));
  return <div className="row wrap" style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
    <strong>{mine.name}</strong><span className="muted">{mine.code ?? ''}</span>
    <span>{wellsQuery.data?.length ?? 0} скважин</span>
    {wellsQuery.error && <span className="danger">{wellsQuery.error}</span>}
    {canManage && <SelectField label="Координатор проекта" value={selectedCoordinatorId} onChange={(event) => onCoordinatorChange(event.target.value)}>
      <option value="">Выберите координатора</option>
      {coordinators.map((coordinator) => <option key={coordinator.id} value={coordinator.id}>{coordinator.user.fullName}</option>)}
    </SelectField>}
    {canManage && <TextField label="Дата назначения" type="date" value={startsAt} onChange={(event) => onDateChange(event.target.value)} />}
    {canManage && <button type="button" className="btn" disabled={pending || !selectedCoordinatorId} onClick={onAssign}>Назначить координатора</button>}
  </div>;
}
