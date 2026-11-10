import { useEffect, useState } from 'react';
import { DEFAULT_TEMP_PASSWORD, createUserSchema, updateUserSchema, type PositionDto, type UserDto } from '@app/shared';
import { api, errorMessage } from '../../core/api.ts';
import { useCurrentUser } from '../../core/auth.tsx';
import { Alert, Checkbox, Dialog, PasswordField, SelectField, TextField } from '@app/shared/ui';
import { invalidate, useAction, useQuery } from '../../core/data.ts';
import { useForm } from '../../core/form.ts';

export type UserDialogMode = 'create' | 'view' | 'edit';
type Track = 'TRS' | 'R_AND_M';
interface Base { id: number; name: string }
interface EmployeeOption { id: number; user: { fullName: string; systemRoles: { systemRole: { code: string } }[] }; assignments: { baseId: number | null; track: Track | 'UNASSIGNED' }[] }
interface EmployeeAssignment { track: Track | 'UNASSIGNED'; baseId: number | null; supervisorEmployeeId: number | null; startsAt: string }
interface Props {
  open: boolean;
  mode: UserDialogMode;
  user?: UserDto;
  personnel?: boolean;
  assignment?: EmployeeAssignment;
  onClose: () => void;
  onModeChange?: (mode: UserDialogMode) => void;
}

const empty = (user?: UserDto) => ({
  fullName: user?.fullName ?? '',
  login: user?.login ?? '',
  password: user ? '' : DEFAULT_TEMP_PASSWORD,
  positionId: user?.positionId ? String(user.positionId) : '',
  phone: user?.phone ?? '',
  email: user?.email ?? '',
  isActive: user?.isActive ?? true,
});

const today = () => new Date().toISOString().slice(0, 10);

export function UserFormDialog({ open, mode, user, personnel = false, assignment, onClose, onModeChange }: Props) {
  const me = useCurrentUser();
  const isEdit = mode === 'edit';
  const isView = mode === 'view';
  const isSelf = user?.id === me.id;
  const form = useForm(empty(user));
  const { reset } = form;
  const positions = useQuery(open ? 'admin:positions:all' : null, () => api.get<PositionDto[]>('/admin/positions', { archived: true }));
  const bases = useQuery(open && personnel ? 'org:bases' : null, () => api.get<Base[]>('/org/bases'));
  const employees = useQuery(open && personnel ? 'org:employees' : null, () => api.get<EmployeeOption[]>('/org/employees'));
  const [track, setTrack] = useState<Track>(assignment?.track === 'R_AND_M' ? 'R_AND_M' : 'TRS');
  const [baseId, setBaseId] = useState(assignment?.baseId ? String(assignment.baseId) : '');
  const [supervisorId, setSupervisorId] = useState(assignment?.supervisorEmployeeId ? String(assignment.supervisorEmployeeId) : '');
  const [startsAt, setStartsAt] = useState(assignment?.startsAt?.slice(0, 10) ?? today());
  const positionOptions = (positions.data ?? []).filter((position) => !position.isArchived || position.id === user?.positionId);
  const selectedPosition = positionOptions.find((position) => String(position.id) === form.values.positionId);
  const roleCode = selectedPosition?.systemRole.code ?? '';
  const requiredSupervisor = roleCode === 'COORDINATOR' ? 'MANAGER' : roleCode === 'EMPLOYEE' ? 'COORDINATOR' : roleCode === 'MECHANIC' ? 'SENIOR_MECHANIC' : roleCode === 'SHOP_FOREMAN' ? 'MECHANIC' : roleCode === 'SHOP_EMPLOYEE' ? 'SHOP_FOREMAN' : '';
  const supervisors = (employees.data ?? []).filter((employee) => employee.user.systemRoles.some((grant) => grant.systemRole.code === requiredSupervisor) && (!baseId || employee.assignments[0]?.baseId === Number(baseId)) && (!track || employee.assignments[0]?.track === track));

  useEffect(() => {
    if (!open) return;
    reset(empty(user));
    setTrack(assignment?.track === 'R_AND_M' ? 'R_AND_M' : 'TRS');
    setBaseId(assignment?.baseId ? String(assignment.baseId) : '');
    setSupervisorId(assignment?.supervisorEmployeeId ? String(assignment.supervisorEmployeeId) : '');
    setStartsAt(assignment?.startsAt?.slice(0, 10) ?? today());
  }, [open, user, assignment, reset]);

  const save = useAction(async (data: unknown) => {
    if (isEdit) {
      const result = await api.patch(`/admin/users/${user!.id}`, data);
      if (personnel && assignment?.track === 'UNASSIGNED' && (baseId || roleCode === 'SENIOR_MECHANIC') && startsAt) {
        const employee = await api.get<{ id: number }>(`/org/users/${user!.id}/employee`);
        await api.post(`/org/employees/${employee.id}/assignments`, {
          track,
          ...(baseId ? { baseId: Number(baseId) } : {}),
          positionId: Number(form.values.positionId),
          supervisorEmployeeId: supervisorId ? Number(supervisorId) : null,
          startsAt,
        });
      }
      return api.get<{ user: UserDto }>(`/admin/users/${user!.id}`).then((response) => response.user ?? result);
    }
    if (personnel) {
      return api.post('/admin/users/personnel', {
        user: data,
        assignment: {
          track,
          ...(baseId ? { baseId: Number(baseId) } : {}),
          positionId: Number(form.values.positionId),
          supervisorEmployeeId: supervisorId ? Number(supervisorId) : null,
          startsAt,
        },
      });
    }
    return api.post('/admin/users', data);
  }, {
    onSuccess: () => {
      invalidate('admin');
      invalidate('org:');
      onClose();
    },
    onError: (error) => form.applyServerErrors(error),
  });

  const submit = () => {
    const { fullName, positionId, phone, email, isActive, login, password } = form.values;
    const payload = isEdit
      ? { fullName, positionId: Number(positionId), phone, email, isActive }
      : { fullName, login, password, positionId: Number(positionId), phone, email };
    const valid = isEdit ? form.validate(updateUserSchema, payload) : form.validate(createUserSchema, payload);
    if (!valid) return;
    const requiresBase = roleCode !== 'SENIOR_MECHANIC';
    if (personnel && ((!baseId && requiresBase) || !startsAt || (requiredSupervisor && !supervisorId))) {
      form.setErrors({ ...form.errors, positionId: 'Выберите должность, базу, дату назначения и руководителя' });
      return;
    }
    save.run(payload);
  };

  const hasFieldErrors = Object.values(form.errors).some(Boolean);
  const title = mode === 'create' ? 'Новый сотрудник' : mode === 'view' ? 'Карточка сотрудника' : 'Редактирование сотрудника';

  return (
    <Dialog open={open} wide title={title} onClose={onClose} onSubmit={isView ? undefined : submit}
      actions={isView ? <><button type="button" className="btn btn-primary" onClick={() => onModeChange?.('edit')}>Редактировать</button><button type="button" className="btn" onClick={onClose}>Закрыть</button></> : <><button type="button" className="btn" onClick={onClose}>Отмена</button><button type="submit" className="btn btn-primary" disabled={save.pending}>{isEdit ? 'Сохранить' : 'Создать'}</button></>}>
      <TextField label="ФИО *" disabled={isView} {...form.field('fullName')} />
      <div className="form-grid">
        <TextField label="Логин *" disabled={isView || isEdit} {...form.field('login')} />
        {!isEdit && !isView && <PasswordField label="Временный пароль *" autoComplete="new-password" help="Сотрудник сменит пароль при первом входе" {...form.field('password')} />}
      </div>
      <SelectField label="Должность *" disabled={isView} {...form.field('positionId')}>
        <option value="">Выберите должность</option>
        {positionOptions.map((position) => <option key={position.id} value={position.id}>{position.name} · {position.systemRole.code}{position.isArchived ? ' (в архиве)' : ''}</option>)}
      </SelectField>
      {selectedPosition && <p className="muted small">Системная роль по должности: {selectedPosition.systemRole.name} ({selectedPosition.systemRole.code})</p>}
      {personnel && !isView && <>
        <div className="form-grid">
          <SelectField label="Направление *" disabled={isEdit && !!assignment && assignment.track !== 'UNASSIGNED'} value={track} onChange={(event) => { setTrack(event.target.value as Track); setSupervisorId(''); }}>
            <option value="TRS">Полевой персонал</option><option value="R_AND_M">Цеховой персонал R&amp;M</option>
          </SelectField>
          <SelectField label="База *" disabled={isEdit && !!assignment && assignment.track !== 'UNASSIGNED'} value={baseId} onChange={(event) => { setBaseId(event.target.value); setSupervisorId(''); }}>
            <option value="">Выберите базу</option>{(bases.data ?? []).map((base) => <option key={base.id} value={base.id}>{base.name}</option>)}
          </SelectField>
          {requiredSupervisor && <SelectField label="Непосредственный руководитель *" disabled={isEdit && !!assignment && assignment.track !== 'UNASSIGNED'} value={supervisorId} onChange={(event) => setSupervisorId(event.target.value)}>
            <option value="">Выберите руководителя</option>{supervisors.map((employee) => <option key={employee.id} value={employee.id}>{employee.user.fullName}</option>)}
          </SelectField>}
          <TextField label="Дата начала назначения *" disabled={isEdit && !!assignment && assignment.track !== 'UNASSIGNED'} type="date" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} />
        </div>
        {isEdit && <p className="muted small">Текущее направление: {assignment?.track ?? 'не назначено'} · база ID {assignment?.baseId ?? 'не задана'}. Изменение должности сразу синхронизирует системную роль.</p>}
      </>}
      <div className="form-grid"><TextField label="Телефон" disabled={isView} {...form.field('phone')} /><TextField label="Email" type="email" disabled={isView} {...form.field('email')} /></div>
      {isEdit && !isView && <Checkbox label={form.values.isActive ? 'Активен' : 'Заблокирован'} checked={form.values.isActive} disabled={isSelf} onChange={(value) => form.set('isActive', value)} />}
      {isView && <div><div className="muted small">Статус</div><span className={`chip small ${form.values.isActive ? 'success' : 'danger'}`}>{form.values.isActive ? 'Активен' : 'Заблокирован'}</span></div>}
      {save.error && !hasFieldErrors ? <Alert>{errorMessage(save.error)}</Alert> : null}
    </Dialog>
  );
}
