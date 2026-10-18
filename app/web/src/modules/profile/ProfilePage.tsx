import { updateProfileSchema, type UserDto } from '@app/shared';
import { api, errorMessage } from '../../core/api.ts';
import { useAuth, useCurrentUser } from '../../core/auth.tsx';
import { Alert, PageHeader, TextField } from '@app/shared/ui';
import { useAction } from '../../core/data.ts';
import { useForm } from '../../core/form.ts';
import { ROLE_LABELS } from '../../core/utils.ts';

function ReadOnly({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <div className="muted small">{label}</div>
      <div>{value || '—'}</div>
    </div>
  );
}

export function ProfilePage() {
  const user = useCurrentUser();
  const { setUser } = useAuth();
  const form = useForm({ phone: user.phone ?? '', email: user.email ?? '' });
  const save = useAction((data: unknown) => api.patch<UserDto>('/me', data), {
    onSuccess: setUser,
    onError: (err) => form.applyServerErrors(err),
  });

  return (
    <>
      <PageHeader title="Профиль" />
      <div className="panel pad-lg stack" style={{ maxWidth: 560 }}>
        <ReadOnly label="ФИО" value={user.fullName} />
        <ReadOnly label="Логин" value={user.login} />
        <ReadOnly label="Роль" value={ROLE_LABELS[user.role]} />
        <ReadOnly label="Должность" value={user.position} />
        <div className="muted small">ФИО и должность меняет администратор.</div>
        <form
          noValidate
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            const data = form.validate(updateProfileSchema);
            if (data) save.run(form.values);
          }}
        >
          <TextField label="Телефон" {...form.field('phone')} />
          <TextField label="Email" type="email" {...form.field('email')} />
          {save.done && <Alert kind="success">Сохранено</Alert>}
          {save.error && !form.errors.phone && !form.errors.email ? <Alert>{errorMessage(save.error)}</Alert> : null}
          <div>
            <button type="submit" className="btn btn-primary" disabled={save.pending}>
              Сохранить
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
