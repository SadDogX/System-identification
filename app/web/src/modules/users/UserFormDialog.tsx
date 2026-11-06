import { useEffect, useState } from 'react';
import { DEFAULT_TEMP_PASSWORD, createUserSchema, updateUserSchema, type PositionDto, type UserDto } from '@app/shared';
import { api, errorMessage } from '../../core/api.ts';
import { useCurrentUser } from '../../core/auth.tsx';
import { Alert, Checkbox, Dialog, PasswordField, SelectField, TextField } from '@app/shared/ui';
import { invalidate, useAction, useQuery } from '../../core/data.ts';
import { useForm } from '../../core/form.ts';
import { ROLE_LABELS } from '../../core/utils.ts';

export type UserDialogMode = 'create' | 'view' | 'edit';

interface Props {
  open: boolean;
  mode: UserDialogMode;
  /** Не задан — создание нового пользователя. */
  user?: UserDto;
  systemRoles?: string[];
  onClose: () => void;
  onModeChange?: (mode: UserDialogMode) => void;
}

const NO_SYSTEM_ROLES: string[] = [];

const empty = (user?: UserDto) => ({
  fullName: user?.fullName ?? '',
  login: user?.login ?? '',
  // Новому пользователю сразу подставляем стандартный временный пароль
  password: user ? '' : DEFAULT_TEMP_PASSWORD,
  role: user?.role ?? 'USER',
  positionId: user?.positionId ? String(user.positionId) : '',
  phone: user?.phone ?? '',
  email: user?.email ?? '',
  isActive: user?.isActive ?? true,
});

export function UserFormDialog({ open, mode, user, systemRoles, onClose, onModeChange }: Props) {
  const me = useCurrentUser();
  const isEdit = mode === 'edit';
  const isView = mode === 'view';
  const isSelf = user?.id === me.id;
  const form = useForm(empty(user));
  const { reset } = form;
  const positions = useQuery(open ? 'admin:positions:all' : null, () => api.get<PositionDto[]>('/admin/positions', { archived: true }));
  const roleCatalog = useQuery(open && isEdit ? 'admin:system-roles' : null, () => api.get<{ code: string; name: string; isActive: boolean }[]>('/admin/org/roles'));
  const currentSystemRoles = systemRoles ?? user?.systemRoles ?? NO_SYSTEM_ROLES;
  const [selectedSystemRoles, setSelectedSystemRoles] = useState<string[]>(currentSystemRoles);
  // Архивные должности не предлагаются, но текущая остаётся в списке
  const positionOptions = (positions.data ?? []).filter((p) => !p.isArchived || p.id === user?.positionId);

  useEffect(() => {
    if (!open) return;
    reset(empty(user));
    setSelectedSystemRoles(currentSystemRoles);
  }, [open, user, currentSystemRoles, reset]);

  const save = useAction(async (data: unknown) => {
    const result = isEdit ? await api.patch(`/admin/users/${user!.id}`, data) : await api.post('/admin/users', data);
    const currentRoles = [...currentSystemRoles].sort();
    const nextRoles = [...selectedSystemRoles].sort();
    const rolesChanged = currentRoles.length !== nextRoles.length || currentRoles.some((role, index) => role !== nextRoles[index]);
    if (isEdit && user && !isSelf && rolesChanged) await api.put(`/admin/org/users/${user.id}/roles`, { roles: selectedSystemRoles });
    if (isEdit && user) return api.get<{ user: UserDto }>(`/admin/users/${user.id}`).then((response) => response.user);
    return result;
  }, {
    onSuccess: (updatedUser) => {
      invalidate('admin');
      if (isEdit && updatedUser && typeof updatedUser === 'object' && 'systemRoles' in updatedUser) setSelectedSystemRoles((updatedUser as UserDto).systemRoles);
      onClose();
    },
    onError: (err) => form.applyServerErrors(err),
  });

  const submit = () => {
    const { fullName, role, positionId, phone, email, isActive, login, password } = form.values;
    const payload = isEdit
      ? { fullName, role, positionId, phone, email, isActive }
      : { fullName, login, password, role, positionId, phone, email };
    const valid = isEdit ? form.validate(updateUserSchema, payload) : form.validate(createUserSchema, payload);
    if (valid) save.run(payload);
  };

  const hasFieldErrors = Object.values(form.errors).some(Boolean);

  const title = mode === 'create' ? 'Новый пользователь' : mode === 'view' ? 'Просмотр пользователя' : 'Редактирование пользователя';

  return (
    <Dialog
      open={open}
      wide
      title={title}
      onClose={onClose}
      onSubmit={isView ? undefined : submit}
      actions={
        isView ? (
          <>
            {onModeChange && (
              <button type="button" className="btn btn-primary" onClick={() => onModeChange('edit')}>
                Редактировать
              </button>
            )}
            <button type="button" className="btn" onClick={onClose}>
              Закрыть
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn" onClick={onClose}>
              Отмена
            </button>
            <button type="submit" className="btn btn-primary" disabled={save.pending}>
              {isEdit ? 'Сохранить' : 'Создать'}
            </button>
          </>
        )
      }
    >
      <TextField label="ФИО *" disabled={isView} {...form.field('fullName')} />
      <div className="form-grid">
        <TextField label="Логин *" disabled={isView || isEdit} {...form.field('login')} />
        {!isEdit && !isView && <PasswordField label="Временный пароль *" autoComplete="new-password" help="Пользователь сменит его при первом входе" {...form.field('password')} />}
      </div>
      <SelectField
        label="Базовая роль учётной записи"
        disabled={isView || isSelf}
        help="USER/ADMIN — роль аккаунта; системные роли и должность задаются отдельно."
        {...form.field('role')}
      >
        {(['USER', 'ADMIN'] as const).map((r) => (
          <option key={r} value={r}>
            {ROLE_LABELS[r]}
          </option>
        ))}
      </SelectField>
      {isEdit && <section className="stack tight" aria-label="System roles">
        <strong>Системные роли</strong>
        <span className="muted small">Дополнительные права доступа. Должность и базовая роль учётной записи редактируются отдельно.</span>
        {roleCatalog.loading && <span className="muted small">Загружаю системные роли…</span>}
        {roleCatalog.error && <Alert>{roleCatalog.error}</Alert>}
        {roleCatalog.data?.filter((item) => item.isActive).map((item) => (
          <label className="check-row" key={item.code}>
            <input type="checkbox" checked={selectedSystemRoles.includes(item.code)} disabled={isView || isSelf || item.code === 'ADMIN' || save.pending || !roleCatalog.data}
              onChange={(event) => setSelectedSystemRoles((current) => event.target.checked ? [...current, item.code] : current.filter((code) => code !== item.code))} />
            <span>{item.name} <span className="muted small">({item.code}{item.code === 'ADMIN' ? ', назначается отдельно' : ''})</span></span>
          </label>
        ))}
      </section>}
      <SelectField label="Должность" disabled={isView} help="Список ведётся в разделе «Должности»" {...form.field('positionId')}>
        <option value="">— не указана —</option>
        {positionOptions.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
            {p.isArchived ? ' (в архиве)' : ''}
          </option>
        ))}
      </SelectField>
      <div className="form-grid">
        <TextField label="Телефон" disabled={isView} {...form.field('phone')} />
        <TextField label="Email" type="email" disabled={isView} {...form.field('email')} />
      </div>
      {isEdit && !isView && (
        <Checkbox
          label={form.values.isActive ? 'Активен' : 'Заблокирован'}
          checked={form.values.isActive}
          disabled={isSelf}
          onChange={(v) => form.set('isActive', v)}
        />
      )}
      {isView && (
        <div>
          <div className="muted small">Статус</div>
          <span className={`chip small ${form.values.isActive ? 'success' : 'danger'}`}>{form.values.isActive ? 'Активен' : 'Заблокирован'}</span>
        </div>
      )}
      {save.error && !hasFieldErrors ? <Alert>{errorMessage(save.error)}</Alert> : null}
    </Dialog>
  );
}
