import { useEffect } from 'react';
import { createUserSchema, updateUserSchema, type PositionDto, type UserDto } from '@app/shared';
import { api, errorMessage } from '../../api.ts';
import { useCurrentUser } from '../../auth.tsx';
import { Alert, Checkbox, Dialog, PasswordField, SelectField, TextField } from '../../components/ui.tsx';
import { invalidate, useAction, useQuery } from '../../data.ts';
import { useForm } from '../../form.ts';
import { ROLE_LABELS } from '../../utils.ts';

interface Props {
  open: boolean;
  /** Не задан — создание нового пользователя. */
  user?: UserDto;
  onClose: () => void;
}

const empty = (user?: UserDto) => ({
  fullName: user?.fullName ?? '',
  login: user?.login ?? '',
  password: '',
  role: user?.role ?? 'USER',
  positionId: user?.positionId ? String(user.positionId) : '',
  phone: user?.phone ?? '',
  email: user?.email ?? '',
  isActive: user?.isActive ?? true,
});

export function UserFormDialog({ open, user, onClose }: Props) {
  const me = useCurrentUser();
  const isEdit = !!user;
  const isSelf = user?.id === me.id;
  const form = useForm(empty(user));
  const { reset } = form;
  const positions = useQuery(open ? 'admin:positions:all' : null, () => api.get<PositionDto[]>('/admin/positions', { archived: true }));
  // Архивные должности не предлагаются, но текущая остаётся в списке
  const positionOptions = (positions.data ?? []).filter((p) => !p.isArchived || p.id === user?.positionId);

  useEffect(() => {
    if (open) reset(empty(user));
  }, [open, user, reset]);

  const save = useAction((data: unknown) => (isEdit ? api.patch(`/admin/users/${user!.id}`, data) : api.post('/admin/users', data)), {
    onSuccess: () => {
      invalidate('admin');
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

  return (
    <Dialog
      open={open}
      wide
      title={isEdit ? 'Редактирование пользователя' : 'Новый пользователь'}
      onClose={onClose}
      onSubmit={submit}
      actions={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Отмена
          </button>
          <button type="submit" className="btn btn-primary" disabled={save.pending}>
            {isEdit ? 'Сохранить' : 'Создать'}
          </button>
        </>
      }
    >
      <TextField label="ФИО *" {...form.field('fullName')} />
      <div className="form-grid">
        <TextField label="Логин *" disabled={isEdit} {...form.field('login')} />
        {!isEdit && <PasswordField label="Временный пароль *" autoComplete="new-password" help="Пользователь сменит его при первом входе" {...form.field('password')} />}
      </div>
      <SelectField
        label="Роль"
        disabled={isSelf}
        help={isSelf ? 'Собственную роль изменить нельзя' : 'Удостоверения ведутся только у сотрудников'}
        {...form.field('role')}
      >
        {(['USER', 'ADMIN'] as const).map((r) => (
          <option key={r} value={r}>
            {ROLE_LABELS[r]}
          </option>
        ))}
      </SelectField>
      <SelectField label="Должность" help="Список ведётся в разделе «Должности»" {...form.field('positionId')}>
        <option value="">— не указана —</option>
        {positionOptions.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
            {p.isArchived ? ' (в архиве)' : ''}
          </option>
        ))}
      </SelectField>
      <div className="form-grid">
        <TextField label="Телефон" {...form.field('phone')} />
        <TextField label="Email" type="email" {...form.field('email')} />
      </div>
      {isEdit && (
        <Checkbox
          label={form.values.isActive ? 'Активен' : 'Заблокирован'}
          checked={form.values.isActive}
          disabled={isSelf}
          onChange={(v) => form.set('isActive', v)}
        />
      )}
      {save.error && !hasFieldErrors ? <Alert>{errorMessage(save.error)}</Alert> : null}
    </Dialog>
  );
}
