import { useState } from 'react';
import { DEFAULT_TEMP_PASSWORD, type UserCredentialDto, type UserDto } from '@app/shared';
import { api, errorMessage } from '../../core/api.ts';
import { useCurrentUser } from '../../core/auth.tsx';
import { useAdminCredentialActions } from '../credentials/AdminCredentialActions.tsx';
import { CredentialView, ViewToggle, useViewMode } from '../credentials/CredentialViews.tsx';
import { Icon, Alert, ConfirmDialog, PageHeader, PasswordField } from '@app/shared/ui';
import { invalidate, useAction, useQuery } from '../../core/data.ts';
import { Link, useRouter } from '../../core/router.tsx';
import { useLanguage } from '../../core/i18n.tsx';
import { APP_MESSAGES, appMessage } from '../../core/appMessages.ts';
import { buildExpiryDraft, setMessageDraft } from '../messages/messageDraft.ts';
import { UserFormDialog } from './UserFormDialog.tsx';

export function UserDetailPage({ id }: { id: number }) {
  const me = useCurrentUser();
  const { language, t, translateText } = useLanguage();
  const m = (key: keyof typeof APP_MESSAGES.ru, values?: Record<string, string | number>) => appMessage(language, key, values);
  const { navigate } = useRouter();
  const [mode, setMode, isMobile] = useViewMode();
  const { renderActions, dialogs } = useAdminCredentialActions();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const { data, error } = useQuery(`admin:user:${id}`, () => api.get<{ user: UserDto; credentials: UserCredentialDto[] }>(`/admin/users/${id}`));
  const remove = useAction(() => api.delete(`/admin/users/${id}`), { onSuccess: () => { invalidate('admin'); navigate('/admin/users'); } });
  const unlock = useAction(() => api.post(`/admin/users/${id}/unlock`), { onSuccess: () => invalidate(`admin:user:${id}`) });
  const reset = useAction(() => api.post(`/admin/users/${id}/reset-password`, { password: newPassword }), { onSuccess: () => setResetOpen(false) });
  if (error) return <Alert>{m('noEmployees')}</Alert>;
  if (!data) return null;
  const { user, credentials } = data;
  const isSelf = user.id === me.id;
  const attention = credentials.filter((credential) => !credential.isMarkedForDeletion && (credential.status === 'RED' || credential.status === 'YELLOW'));
  const anyRed = attention.some((credential) => credential.status === 'RED');
  const writeMessage = () => { setMessageDraft(buildExpiryDraft(user, credentials)); navigate('/admin/messages'); };

  return <>
    <div className="mb"><Link to="/admin/users" className="btn btn-sm"><Icon name="back" small />{m('employeeDirectory')}</Link></div>
    <PageHeader title={user.fullName} subtitle={`${user.position ?? t(`roles.${user.systemRoles[0] ?? 'EMPLOYEE'}`)} · ${user.login}`} actions={<>
      {!user.systemRoles.includes('ADMIN') && user.isActive && <button type="button" className={`btn ${attention.length ? (anyRed ? 'btn-danger' : 'btn-warning') : 'btn-outline'}`} onClick={writeMessage}><Icon name="send" small />{m('sendMessage')}</button>}
      {!user.isActive && <button type="button" className="btn btn-outline" disabled={unlock.pending} onClick={() => unlock.run()}><Icon name="restore" small />{m('unlockUser')}</button>}
      <button type="button" className="btn btn-outline" onClick={() => setEditOpen(true)}><Icon name="edit" small />{t('common.edit')}</button>
      {!isSelf && <button type="button" className="btn btn-outline" onClick={() => setResetOpen(true)}><Icon name="key" small />{m('resetPassword')}</button>}
    </>} />
    <div className="panel pad row wrap"><Info label={t('auth.login')} value={user.login} /><Info label={t('common.position')} value={user.position} /><Info label={t('common.role')} value={user.systemRoles.map((role) => t(`roles.${role}`)).join(', ')} /><Info label={t('common.phone')} value={user.phone} /><Info label={t('common.email')} value={user.email} /><Info label={t('common.status')} value={user.isActive ? t('common.active') : t('common.blocked')} /></div>
    <section className="stack"><div className="row between"><h2 className="section-title">{t('common.credentials')}</h2><ViewToggle value={mode} onChange={setMode} hidden={isMobile} /></div><CredentialView mode={mode} items={credentials} actions={renderActions} emptyText={m('credentialsEmpty')} /></section>
    {dialogs}
    <UserFormDialog open={editOpen} mode="edit" user={user} onClose={() => setEditOpen(false)} />
    <ConfirmDialog open={deleteOpen} title={m('deleteUserTitle')} text={m('deleteUserText')} confirmText={t('common.delete')} danger disabled={remove.pending} onConfirm={() => remove.run()} onClose={() => setDeleteOpen(false)}>{remove.error ? <Alert>{errorMessage(remove.error)}</Alert> : null}</ConfirmDialog>
    <ConfirmDialog open={resetOpen} title={m('resetPasswordTitle')} text={m('resetPasswordText')} confirmText={m('resetPassword')} disabled={reset.pending} onConfirm={() => reset.run()} onClose={() => setResetOpen(false)}>
      <PasswordField label={t('auth.newPassword')} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
      {reset.error ? <Alert>{errorMessage(reset.error)}</Alert> : null}
    </ConfirmDialog>
  </>;
}

function Info({ label, value }: { label: string; value: string | null }) {
  return <div style={{ minWidth: 160 }}><div className="muted small">{label}</div><div>{value || '—'}</div></div>;
}
