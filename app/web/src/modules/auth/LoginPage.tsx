import type { ReactNode } from 'react';
import { loginRequestSchema } from '@app/shared';
import { errorMessage } from '../../core/api.ts';
import { homePath, useAuth } from '../../core/auth.tsx';
import { Icon, Alert, PasswordField, TextField } from '@app/shared/ui';
import { useAction } from '../../core/data.ts';
import { useForm } from '../../core/form.ts';
import { Redirect, useRouter } from '../../core/router.tsx';

export function AuthCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-head">
          <Icon name="badge" />
          {title}
        </div>
        {children}
      </div>
    </div>
  );
}

export function LoginPage() {
  const { user, login, initializing } = useAuth();
  const { navigate } = useRouter();
  const form = useForm({ login: '', password: '' });
  const submit = useAction(login, {
    onSuccess: (u) => navigate(u.mustChangePassword ? '/change-password' : homePath(u), { replace: true }),
  });

  if (!initializing && user) return <Redirect to={homePath(user)} />;

  return (
    <AuthCard title="Учёт удостоверений сотрудников">
      <form
        noValidate
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          const data = form.validate(loginRequestSchema);
          if (data) submit.run(data);
        }}
      >
        <TextField label="Логин" autoComplete="username" autoFocus {...form.field('login')} />
        <PasswordField label="Пароль" autoComplete="current-password" {...form.field('password')} />
        {submit.error ? <Alert>{errorMessage(submit.error)}</Alert> : null}
        <button type="submit" className="btn btn-primary btn-lg" disabled={submit.pending}>
          Войти
        </button>
      </form>
    </AuthCard>
  );
}
