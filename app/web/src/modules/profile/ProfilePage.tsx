import { updateProfileSchema, type UserDto } from '@app/shared';
import { api, errorMessage } from '../../core/api.ts';
import { useAuth, useCurrentUser } from '../../core/auth.tsx';
import { Alert, PageHeader, TextField } from '@app/shared/ui';
import { useAction } from '../../core/data.ts';
import { useForm } from '../../core/form.ts';
import { useLanguage } from '../../core/i18n.tsx';
import { APP_MESSAGES, appMessage } from '../../core/appMessages.ts';

function ReadOnly({ label, value }: { label: string; value: string | null }) {
  return <div><div className="muted small">{label}</div><div>{value || '—'}</div></div>;
}

export function ProfilePage() {
  const user = useCurrentUser();
  const { language, t } = useLanguage();
  const m = (key: keyof typeof APP_MESSAGES.ru) => appMessage(language, key);
  const { setUser } = useAuth();
  const form = useForm({ phone: user.phone ?? '', email: user.email ?? '' });
  const save = useAction((data: unknown) => api.patch<UserDto>('/me', data), { onSuccess: setUser, onError: (error) => form.applyServerErrors(error) });

  return <>
    <PageHeader title={t('profile')} />
    <div className="panel pad-lg stack" style={{ maxWidth: 560 }}>
      <ReadOnly label={t('common.fullName')} value={user.fullName} />
      <ReadOnly label={t('auth.login')} value={user.login} />
      <ReadOnly label={t('common.position')} value={user.position ?? '—'} />
      <ReadOnly label={t('common.role')} value={t(`roles.${user.systemRoles[0] ?? 'EMPLOYEE'}`)} />
      <ReadOnly label={m('photo')} value={user.photoFile ? m('photoUploaded') : null} />
      <input type="file" accept="image/jpeg,image/png,image/webp" aria-label={m('photo')} onChange={(event) => { const file = event.target.files?.[0]; if (file) api.put('/me/profile-photo', file).then(() => window.location.reload()); }} />
      <div className="muted small">{m('profileAdminHint')}</div>
      <form noValidate className="stack" onSubmit={(event) => { event.preventDefault(); const data = form.validate(updateProfileSchema); if (data) save.run(data); }}>
        <TextField label={t('common.phone')} {...form.field('phone')} />
        <TextField label={t('common.email')} type="email" {...form.field('email')} />
        {save.done && <Alert kind="success">{t('common.saved')}</Alert>}
        {save.error && !form.errors.phone && !form.errors.email ? <Alert>{errorMessage(save.error)}</Alert> : null}
        <button type="submit" className="btn btn-primary" disabled={save.pending}>{t('common.save')}</button>
      </form>
    </div>
  </>;
}
