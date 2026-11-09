import { useMemo, useState } from 'react';
import type { PositionDto, UserDto } from '@app/shared';
import { api } from '../../core/api.ts';
import { invalidate, useQuery } from '../../core/data.ts';
import { Alert, Icon, PageHeader, SearchInput } from '@app/shared/ui';
import { Link } from '../../core/router.tsx';
import { UserFormDialog, type UserDialogMode } from '../users/UserFormDialog.tsx';
import { filterAndSortPersonnel, type PersonnelSortDirection, type PersonnelSortKey } from './personnelTable.ts';

type Track = 'TRS' | 'R_AND_M' | 'UNASSIGNED';
interface Base { id: number; name: string; code: string | null }
interface Assignment { baseId: number | null; supervisorEmployeeId: number | null; startsAt: string; track: Track; positionId: number | null; position: { name: string } | null }
interface Employee { id: number; user: { id: number; fullName: string; login: string; phone: string | null; email: string | null; systemRoles: { systemRole: { code: string } }[] }; assignments: Assignment[] }
interface PersonnelAssignment { baseId: number | null; supervisorEmployeeId: number | null; startsAt: string; track: Track }

export function PersonnelPage() {
  const basesQuery = useQuery('org:bases', () => api.get<Base[]>('/org/bases'));
  const positionsQuery = useQuery('org:personnel:positions', () => api.get<PositionDto[]>('/admin/positions'));
  const employeesQuery = useQuery('org:employees', () => api.get<Employee[]>('/org/employees'));
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<{ key: PersonnelSortKey; direction: PersonnelSortDirection }>({ key: 'name', direction: 'asc' });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<UserDialogMode>('create');
  const [selectedUser, setSelectedUser] = useState<UserDto>();
  const [selectedAssignment, setSelectedAssignment] = useState<PersonnelAssignment>();
  const employees = employeesQuery.data ?? [];
  const baseNames = useMemo(() => new Map((basesQuery.data ?? []).map((base) => [base.id, base.name])), [basesQuery.data]);
  const displayed = useMemo(() => filterAndSortPersonnel(employees, search, sort.key, sort.direction, baseNames), [employees, search, sort, baseNames]);

  const closeDialog = () => {
    setDialogOpen(false);
    setSelectedUser(undefined);
    setSelectedAssignment(undefined);
    invalidate('org:employees');
    invalidate('admin:');
  };
  const openDialog = async (employee: Employee, nextMode: UserDialogMode) => {
    try {
      const response = await api.get<{ user: UserDto; credentials: unknown[] }>(`/admin/users/${employee.user.id}`);
      const assignment = employee.assignments[0];
      setSelectedUser(response.user);
      setSelectedAssignment(assignment ? {
        baseId: assignment.baseId,
        supervisorEmployeeId: assignment.supervisorEmployeeId,
        startsAt: assignment.startsAt,
        track: assignment.track,
      } : undefined);
      setDialogMode(nextMode);
      setDialogOpen(true);
    } catch (error) {
      console.error('Unable to load personnel record', error);
    }
  };
  const setSortKey = (key: PersonnelSortKey) => setSort((current) => ({ key, direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc' }));
  const sortHeader = (label: string, key: PersonnelSortKey) => <th aria-sort={sort.key === key ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}><button type="button" className="btn btn-sm btn-outline" onClick={() => setSortKey(key)} aria-label={`Sort by ${label}`}>{label}{sort.key === key ? (sort.direction === 'asc' ? ' ↑' : ' ↓') : ''}</button></th>;

  return <>
    <PageHeader title="Персонал БПО" subtitle="Сотрудники, должности и организационные назначения" actions={<button type="button" className="btn btn-primary" onClick={() => { setSelectedUser(undefined); setSelectedAssignment(undefined); setDialogMode('create'); setDialogOpen(true); }}><Icon name="add" small /> Добавить сотрудника</button>} />
    {(basesQuery.error || positionsQuery.error || employeesQuery.error) && <Alert>{basesQuery.error ?? positionsQuery.error ?? employeesQuery.error}</Alert>}
    <div className="panel pad row wrap" style={{ marginBottom: 12 }}>
      <SearchInput value={search} placeholder="ФИО, логин, контакт, должность или база" onChange={setSearch} />
      <span className="muted" aria-live="polite">{displayed.length} сотрудников</span>
    </div>
    <div className="panel table-wrap"><table className="table"><thead><tr>
      {sortHeader('Сотрудник', 'name')}{sortHeader('Логин', 'login')}{sortHeader('Направление', 'track')}{sortHeader('Должность', 'position')}{sortHeader('База', 'base')}{sortHeader('Роли', 'roles')}
    </tr></thead><tbody>{displayed.map((employee) => {
      const assignment = employee.assignments[0];
      return <tr key={employee.id} className="clickable" role="button" tabIndex={0} onClick={() => void openDialog(employee, 'view')} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); void openDialog(employee, 'view'); } }}>
        <td>{employee.user.fullName}</td><td>{employee.user.login}</td><td>{assignment?.track === 'R_AND_M' ? 'Цеховой' : assignment?.track === 'TRS' ? 'Полевой' : 'Не назначен'}</td><td>{assignment?.position?.name ?? '—'}</td><td>{assignment?.baseId ? baseNames.get(assignment.baseId) ?? '—' : '—'}</td><td>{employee.user.systemRoles.map((grant) => grant.systemRole.code).join(', ') || '—'}</td>
      </tr>;
    })}</tbody></table>{displayed.length === 0 && <div className="empty">Сотрудники не найдены</div>}</div>
    <UserFormDialog open={dialogOpen} mode={dialogMode} user={selectedUser} personnel assignment={selectedAssignment} onClose={closeDialog} onModeChange={setDialogMode} />
  </>;
}
