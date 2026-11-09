import { changePasswordSchema, type AuthResponse } from '@app/shared';
import { api, errorMessage } from '../../core/api.ts';
import { homePath, useAuth, useCurrentUser } from '../../core/auth.tsx';
import { Alert, PasswordField } from '@app/shared/ui';
import { useLanguage } from '../../core/i18n.tsx';
import { useAction } from '../../core/data.ts';
import { useForm } from '../../core/form.ts';
import { useRouter } from '../../core/router.tsx';
import { AuthCard } from './LoginPage.tsx';

export function ChangePasswordPage() {
  const user = useCurrentUser();
  const { applySession, logout } = useAuth();
  const { navigate } = useRouter();
  const form = useForm({ currentPassword: '', newPassword: '', confirm: '' });
  const { t } = useLanguage();

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
      form.setErrors({ confirm: t('auth.mismatch') });
      return;
    }
    save.run(data);
  };

  return (
    <AuthCard title={user.mustChangePassword ? t('auth.setPermanentPassword') : t('auth.changePassword')}>
      {user.mustChangePassword && (
        <div className="mb">
          <Alert kind="info">{t('auth.temporaryPasswordInfo')}</Alert>
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
        <PasswordField label={t('auth.currentPassword')} autoComplete="current-password" {...form.field('currentPassword')} />
        <PasswordField label={t('auth.newPassword')} autoComplete="new-password" {...form.field('newPassword')} />
        <PasswordField label={t('auth.confirmPassword')} autoComplete="new-password" {...form.field('confirm')} />
        {save.error && Object.keys(form.errors).every((k) => !form.errors[k]) ? <Alert>{errorMessage(save.error)}</Alert> : null}
        <button type="submit" className="btn btn-primary" disabled={save.pending}>
          {t('auth.savePassword')}
        </button>
        {user.mustChangePassword ? (
          <button type="button" className="btn" onClick={() => logout().then(() => navigate('/login'))}>
            {t('signOut')}
          </button>
        ) : (
          <button type="button" className="btn" onClick={() => window.history.back()}>
            {t('auth.back')}
          </button>
        )}
      </form>
    </AuthCard>
  );
}
