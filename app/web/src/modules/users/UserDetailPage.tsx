import { useState } from 'react';
import { DEFAULT_TEMP_PASSWORD, type UserCredentialDto, type UserDto } from '@app/shared';
import { api, errorMessage } from '../../core/api.ts';
import { useCurrentUser } from '../../core/auth.tsx';
import { useAdminCredentialActions } from '../credentials/AdminCredentialActions.tsx';
import { CredentialView, ViewToggle, useViewMode } from '../credentials/CredentialViews.tsx';
import { Icon, Alert, ConfirmDialog, PageHeader, PasswordField } from '@app/shared/ui';
import { invalidate, useAction, useQuery } from '../../core/data.ts';
import { Link, useRouter } from '../../core/router.tsx';
import { ROLE_LABELS } from '../../core/utils.ts';
import { buildExpiryDraft, setMessageDraft } from '../messages/messageDraft.ts';
import { UserFormDialog } from './UserFormDialog.tsx';

function Info({ label, value }: { label: string; value: string | null }) {
  return (
    <div style={{ minWidth: 160 }}>
      <div className="muted small">{label}</div>
      <div>{value || '—'}</div>
    </div>
  );
}

export function UserDetailPage({ id }: { id: number }) {
  const me = useCurrentUser();
  const { navigate } = useRouter();
  const [mode, setMode, isMobile] = useViewMode();
  const { renderActions, dialogs } = useAdminCredentialActions();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');

  const { data, error } = useQuery(`admin:user:${id}`, () =>
    api.get<{ user: UserDto; credentials: UserCredentialDto[] }>(`/admin/users/${id}`),
  );

  const remove = useAction(() => api.delete(`/admin/users/${id}`), {
    onSuccess: () => {
      invalidate('admin');
      navigate('/admin/users');
    },
  });
  const reset = useAction(() => api.post(`/admin/users/${id}/reset-password`, { password: newPassword }), {
    onSuccess: () => setResetOpen(false),
  });

  if (error) return <Alert>Пользователь не найден</Alert>;
  if (!data) return null;
  const { user, credentials } = data;
  const isSelf = user.id === me.id;
  const attention = credentials.filter((c) => !c.isMarkedForDeletion && (c.status === 'RED' || c.status === 'YELLOW'));
  const anyRed = attention.some((c) => c.status === 'RED');

  const writeMessage = () => {
    setMessageDraft(buildExpiryDraft(user, credentials));
    navigate('/admin/messages');
  };

  return (
    <>
      <div className="mb">
        <Link to="/admin/users" className="btn btn-sm">
          <Icon name="back" small /> Пользователи
        </Link>
      </div>
      <PageHeader
        title={user.fullName}
        subtitle={`${ROLE_LABELS[user.role]} · ${user.login}`}
        actions={
          <>
            {user.role === 'USER' && user.isActive && (
              <button
                type="button"
                className={`btn ${attention.length ? (anyRed ? 'btn-danger' : 'btn-warning') : 'btn-outline'}`}
                title={attention.length ? 'Сообщение с перечнем удостоверений, у которых подходит или истёк срок' : 'Написать сообщение сотруднику'}
                onClick={writeMessage}
              >
                <Icon name="send" small /> {attention.length ? 'Отправить оповещение' : 'Написать сообщение'}
              </button>
            )}
            <button type="button" className="btn btn-outline" onClick={() => setEditOpen(true)}>
              <Icon name="edit" small /> Редактировать
            </button>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => {
                setNewPassword(DEFAULT_TEMP_PASSWORD);
                reset.reset();
                setResetOpen(true);
              }}
            >
              <Icon name="key" small /> Сбросить пароль
            </button>
            {!isSelf && (
              <button type="button" className="btn btn-outline danger" onClick={() => setDeleteOpen(true)}>
                <Icon name="delete" small /> Удалить
              </button>
            )}
          </>
        }
      />
      {reset.done && (
        <div className="mb">
          <Alert kind="success">Пароль сброшен. Пользователь сменит его при следующем входе.</Alert>
        </div>
      )}

      <div className="panel pad mb-lg">
        <div className="row wrap" style={{ gap: 24, alignItems: 'flex-start' }}>
          <Info label="Должность" value={user.position} />
          <Info label="Телефон" value={user.phone} />
          <Info label="Email" value={user.email} />
          <div>
            <div className="muted small">Статус</div>
            <span className={`chip small ${user.isActive ? 'success' : 'danger'}`}>{user.isActive ? 'Активен' : 'Заблокирован'}</span>
          </div>
        </div>
      </div>

      {user.role === 'USER' && (
        <>
          <div className="row between mb">
            <h2 style={{ fontSize: 18, fontWeight: 600 }}>Удостоверения</h2>
            <ViewToggle value={mode} onChange={setMode} hidden={isMobile} />
          </div>
          <CredentialView mode={mode} items={credentials} actions={renderActions} emptyText="Справочник удостоверений пуст" />
        </>
      )}

      {dialogs}
      <UserFormDialog open={editOpen} user={user} onClose={() => setEditOpen(false)} />
      <ConfirmDialog
        open={deleteOpen}
        title="Удалить пользователя?"
        text={`${user.fullName} пропадёт из списков и не сможет войти. Данные и история сохранятся в базе.`}
        confirmText="Удалить"
        danger
        disabled={remove.pending}
        onConfirm={() => remove.run()}
        onClose={() => setDeleteOpen(false)}
      >
        {remove.error ? <Alert>{errorMessage(remove.error)}</Alert> : null}
      </ConfirmDialog>
      <ConfirmDialog
        open={resetOpen}
        title="Сброс пароля"
        text="Задайте временный пароль и передайте его пользователю. Все его текущие сессии завершатся."
        confirmText="Сбросить"
        disabled={reset.pending || newPassword.length < 8}
        onConfirm={() => reset.run()}
        onClose={() => setResetOpen(false)}
      >
        <PasswordField label="Временный пароль (не менее 8 символов)" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
        {reset.error ? <Alert>{errorMessage(reset.error)}</Alert> : null}
      </ConfirmDialog>
    </>
  );
}
