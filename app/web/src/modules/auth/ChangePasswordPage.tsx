import { changePasswordSchema, type AuthResponse } from '@app/shared';
import { api, errorMessage } from '../../core/api.ts';
import { homePath, useAuth, useCurrentUser } from '../../core/auth.tsx';
import { Alert, PasswordField } from '@app/shared/ui';
import { useAction } from '../../core/data.ts';
import { useForm } from '../../core/form.ts';
import { useRouter } from '../../core/router.tsx';
import { AuthCard } from './LoginPage.tsx';

export function ChangePasswordPage() {
  const user = useCurrentUser();
  const { applySession, logout } = useAuth();
  const { navigate } = useRouter();
  const form = useForm({ currentPassword: '', newPassword: '', confirm: '' });

  const save = useAction(
    (data: { currentPassword: string; newPassword: string }) => api.post<AuthResponse>('/auth/change-password', data),
    {
      onSuccess: (session) => {
        applySession(session);
        navigate(homePath(session.user), { replace: true });
      },
      onError: (err) => form.applyServerErrors(err),
    },
  );

  const submit = () => {
    const data = form.validate(changePasswordSchema);
    if (!data) return;
    if (form.values.newPassword !== form.values.confirm) {
      form.setErrors({ confirm: 'Пароли не совпадают' });
      return;
    }
    save.run(data);
  };

  return (
    <AuthCard title={user.mustChangePassword ? 'Задайте постоянный пароль' : 'Смена пароля'}>
      {user.mustChangePassword && (
        <div className="mb">
          <Alert kind="info">Вы вошли с временным паролем. Придумайте новый, чтобы продолжить работу.</Alert>
        </div>
      )}
      <form
        noValidate
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <PasswordField label="Текущий пароль" autoComplete="current-password" {...form.field('currentPassword')} />
        <PasswordField label="Новый пароль (не менее 8 символов)" autoComplete="new-password" {...form.field('newPassword')} />
        <PasswordField label="Повторите новый пароль" autoComplete="new-password" {...form.field('confirm')} />
        {save.error && Object.keys(form.errors).every((k) => !form.errors[k]) ? <Alert>{errorMessage(save.error)}</Alert> : null}
        <button type="submit" className="btn btn-primary" disabled={save.pending}>
          Сохранить пароль
        </button>
        {user.mustChangePassword ? (
          <button type="button" className="btn" onClick={() => logout().then(() => navigate('/login'))}>
            Выйти
          </button>
        ) : (
          <button type="button" className="btn" onClick={() => window.history.back()}>
            Назад
          </button>
        )}
      </form>
    </AuthCard>
  );
}
