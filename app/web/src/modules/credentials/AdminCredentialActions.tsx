import { useEffect, useState } from 'react';
import { addMonths, formatDateRu, isIsoDate, todayInTimezone, type UserCredentialDto } from '@app/shared';
import { api, errorMessage } from '../../core/api.ts';
import { useAuth } from '../../core/auth.tsx';
import { invalidate, useAction } from '../../core/data.ts';
import { formatValidity } from '../../core/utils.ts';
import { Icon, Alert, ConfirmDialog, Dialog, TextArea, TextField } from '@app/shared/ui';
import { PhotoButton, PhotoField } from './Photo.tsx';

type Kind = 'clear' | 'mark' | 'unmark';
type Pending = { kind: 'edit' | Kind; item: UserCredentialDto } | null;

function EditDialog({ item, onClose }: { item: UserCredentialDto | null; onClose: () => void }) {
  const { settings } = useAuth();
  const today = todayInTimezone(settings.timezone);
  const [number, setNumber] = useState('');
  const [comment, setComment] = useState('');
  const [issueDate, setIssueDate] = useState('');

  const save = useAction(
    () =>
      api.patch(`/admin/credentials/${item!.id}`, {
        number,
        comment,
        ...(issueDate && issueDate !== item!.issueDate && { issueDate }),
      }),
    {
      onSuccess: () => {
        invalidate('admin');
        onClose();
      },
    },
  );

  useEffect(() => {
    if (!item) return;
    setNumber(item.number ?? '');
    setComment(item.comment ?? '');
    setIssueDate(item.issueDate ?? '');
    save.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item]);

  const dateInvalid = !!issueDate && (!isIsoDate(issueDate) || issueDate > today);
  const expiry = item && issueDate && !dateInvalid ? addMonths(issueDate, item.validityMonths) : null;

  return (
    <Dialog
      open={!!item}
      title={item?.name ?? ''}
      onClose={onClose}
      onSubmit={() => !dateInvalid && save.run()}
      actions={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Отмена
          </button>
          <button type="submit" className="btn btn-primary" disabled={dateInvalid || save.pending}>
            Сохранить
          </button>
        </>
      }
    >
      {item?.user && <div className="muted">{item.user.fullName}</div>}
      <TextField label="Номер удостоверения" value={number} onChange={(e) => setNumber(e.target.value)} />
      <TextField
        type="date"
        label="Дата выдачи"
        value={issueDate}
        max={today}
        onChange={(e) => setIssueDate(e.target.value)}
        error={dateInvalid ? 'Дата выдачи не может быть в будущем' : undefined}
        help={item ? `Срок действия: ${formatValidity(item.validityMonths)}` : undefined}
      />
      <div>
        Действительно до: <b>{formatDateRu(expiry)}</b>
      </div>
      {item && <PhotoField item={item} />}
      <TextArea label="Комментарий" value={comment} onChange={(e) => setComment(e.target.value)} rows={3} />
      {save.error ? <Alert>{errorMessage(save.error)}</Alert> : null}
    </Dialog>
  );
}

const CONFIRM: Record<Kind, { title: string; text: string; button: string; url: string }> = {
  clear: {
    title: 'Очистить данные удостоверения?',
    text: 'Номер, даты и комментарий будут стёрты. Само удостоверение останется у сотрудника со статусом «Не заполнено».',
    button: 'Очистить',
    url: 'clear',
  },
  mark: {
    title: 'Пометить на удаление?',
    text: 'Запись пропадёт из списков и статистики, но останется в базе. Пометку можно снять в любой момент.',
    button: 'Пометить',
    url: 'mark-deletion',
  },
  unmark: {
    title: 'Снять пометку на удаление?',
    text: 'Запись снова появится в списках и статистике.',
    button: 'Восстановить',
    url: 'unmark-deletion',
  },
};

/** Действия администратора над удостоверением: редактирование, очистка, пометка на удаление. */
export function useAdminCredentialActions() {
  const [pending, setPending] = useState<Pending>(null);

  const action = useAction((kind: Kind, item: UserCredentialDto) => api.post(`/admin/credentials/${item.id}/${CONFIRM[kind].url}`), {
    onSuccess: () => {
      invalidate('admin');
      setPending(null);
    },
  });

  const open = (kind: 'edit' | Kind, item: UserCredentialDto) => {
    action.reset();
    setPending({ kind, item });
  };

  const renderActions = (item: UserCredentialDto) =>
    item.isMarkedForDeletion ? (
      <>
      <PhotoButton item={item} />
      <button type="button" className="icon-btn" title="Снять пометку на удаление" aria-label="Снять пометку на удаление" onClick={() => open('unmark', item)}>
        <Icon name="restore" />
      </button>
      </>
    ) : (
      <>
        <PhotoButton item={item} />
        <button type="button" className="icon-btn" title="Редактировать" aria-label="Редактировать" onClick={() => open('edit', item)}>
          <Icon name="edit" />
        </button>
        <button
          type="button"
          className="icon-btn"
          title="Очистить данные"
          aria-label="Очистить данные"
          disabled={!item.issueDate && !item.number}
          onClick={() => open('clear', item)}
        >
          <Icon name="clear" />
        </button>
        <button type="button" className="icon-btn" title="Пометить на удаление" aria-label="Пометить на удаление" onClick={() => open('mark', item)}>
          <Icon name="delete" />
        </button>
      </>
    );

  const confirmKind = pending && pending.kind !== 'edit' ? pending.kind : null;
  const dialogs = (
    <>
      <EditDialog item={pending?.kind === 'edit' ? pending.item : null} onClose={() => setPending(null)} />
      {confirmKind && pending && (
        <ConfirmDialog
          open
          title={CONFIRM[confirmKind].title}
          text={`${pending.item.name}${pending.item.user ? ` — ${pending.item.user.fullName}` : ''}. ${CONFIRM[confirmKind].text}`}
          confirmText={CONFIRM[confirmKind].button}
          danger={confirmKind !== 'unmark'}
          disabled={action.pending}
          onConfirm={() => action.run(confirmKind, pending.item)}
          onClose={() => setPending(null)}
        >
          {action.error ? <Alert>{errorMessage(action.error)}</Alert> : null}
        </ConfirmDialog>
      )}
    </>
  );

  return { renderActions, dialogs };
}
