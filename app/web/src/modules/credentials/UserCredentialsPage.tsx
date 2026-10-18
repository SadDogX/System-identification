import { useState } from 'react';
import type { UserCredentialDto } from '@app/shared';
import { api, errorMessage } from '../../core/api.ts';
import { CredentialView, ViewToggle, useViewMode } from './CredentialViews.tsx';
import { Icon, Alert, ConfirmDialog, PageHeader } from '@app/shared/ui';
import { PhotoButton } from './Photo.tsx';
import { UserCredentialDialog } from './UserCredentialDialog.tsx';
import { invalidate, useAction, useQuery } from '../../core/data.ts';

export const useOwnCredentials = () => useQuery('me:credentials', () => api.get<UserCredentialDto[]>('/me/credentials'));

export function UserCredentialsPage() {
  const [mode, setMode, isMobile] = useViewMode();
  const { data = [], error } = useOwnCredentials();
  const [editId, setEditId] = useState<number | null>(null);
  const [clearTarget, setClearTarget] = useState<UserCredentialDto | null>(null);

  const clear = useAction((item: UserCredentialDto) => api.post(`/me/credentials/${item.id}/clear`), {
    onSuccess: () => {
      invalidate('me');
      setClearTarget(null);
    },
  });

  // Диалог берёт актуальную запись из списка — после загрузки фото она обновляется
  const editing = data.find((c) => c.id === editId) ?? null;

  return (
    <>
      <PageHeader
        title="Мои удостоверения"
        subtitle="Укажите дату выдачи и приложите фото — дата окончания рассчитается по сроку из справочника"
        actions={<ViewToggle value={mode} onChange={setMode} hidden={isMobile} />}
      />
      {error && <Alert>Не удалось загрузить удостоверения</Alert>}
      <CredentialView
        mode={mode}
        items={data}
        emptyText="Администратор ещё не добавил удостоверения в справочник"
        actions={(item) => (
          <>
            <PhotoButton item={item} />
            <button type="button" className="btn btn-sm" onClick={() => setEditId(item.id)}>
              <Icon name="edit" small /> {item.issueDate ? 'Изменить' : 'Заполнить'}
            </button>
            <button
              type="button"
              className="icon-btn"
              title="Очистить данные удостоверения"
              aria-label="Очистить данные удостоверения"
              disabled={!item.issueDate && !item.number && !item.photoMime}
              onClick={() => {
                clear.reset();
                setClearTarget(item);
              }}
            >
              <Icon name="clear" />
            </button>
          </>
        )}
      />
      <UserCredentialDialog item={editing} onClose={() => setEditId(null)} />
      <ConfirmDialog
        open={!!clearTarget}
        title="Очистить данные удостоверения?"
        text={`«${clearTarget?.name}»: дата выдачи, дата окончания, номер и фото будут удалены. Удостоверение останется в списке со статусом «Не заполнено».`}
        confirmText="Очистить"
        danger
        disabled={clear.pending}
        onConfirm={() => clearTarget && clear.run(clearTarget)}
        onClose={() => setClearTarget(null)}
      >
        {clear.error ? <Alert>{errorMessage(clear.error)}</Alert> : null}
      </ConfirmDialog>
    </>
  );
}
