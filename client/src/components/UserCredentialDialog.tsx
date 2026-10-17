import { useEffect, useState } from 'react';
import { addMonths, formatDateRu, getCredentialStatus, isIsoDate, todayInTimezone, type UserCredentialDto } from '@app/shared';
import { api, errorMessage } from '../api.ts';
import { useAuth } from '../auth.tsx';
import { invalidate, useAction } from '../data.ts';
import { formatValidity } from '../utils.ts';
import { PhotoField } from './Photo.tsx';
import { StatusBadge } from './StatusBadge.tsx';
import { Alert, Dialog, TextField } from './ui.tsx';

/**
 * Сотрудник открывает удостоверение из своего списка, видит срок из справочника,
 * выбирает дату выдачи в календаре (можно задним числом) и прикладывает фото.
 * Дата окончания считается автоматически.
 */
export function UserCredentialDialog({ item, onClose }: { item: UserCredentialDto | null; onClose: () => void }) {
  const { settings } = useAuth();
  const today = todayInTimezone(settings.timezone);
  const [issueDate, setIssueDate] = useState('');

  const save = useAction(() => api.patch(`/me/credentials/${item!.id}`, { issueDate }), {
    onSuccess: () => {
      invalidate('me');
      onClose();
    },
  });

  useEffect(() => {
    if (!item) return;
    setIssueDate(item.issueDate ?? '');
    save.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id]);

  const validDate = isIsoDate(issueDate) && issueDate <= today;
  const changed = issueDate !== (item?.issueDate ?? '');
  const expiryPreview = item && validDate ? addMonths(issueDate, item.validityMonths) : null;
  const preview = expiryPreview ? getCredentialStatus(expiryPreview, today, settings) : null;
  const dateError = issueDate && !validDate ? 'Дата выдачи не может быть в будущем' : undefined;

  return (
    <Dialog
      open={!!item}
      title={item?.name ?? ''}
      onClose={onClose}
      onSubmit={() => {
        if (!validDate) return;
        if (changed) save.run();
        else onClose();
      }}
      actions={
        <>
          <button type="button" className="btn" onClick={onClose}>
            {changed ? 'Отмена' : 'Закрыть'}
          </button>
          <button type="submit" className="btn btn-primary" disabled={!validDate || save.pending}>
            Сохранить
          </button>
        </>
      }
    >
      {item && (
        <div className="muted">
          Срок действия по справочнику: <b>{formatValidity(item.validityMonths)}</b>
          {item.number && (
            <>
              {' '}
              · номер <b>{item.number}</b>
            </>
          )}
        </div>
      )}

      <TextField
        type="date"
        label="Дата выдачи"
        value={issueDate}
        max={today}
        onChange={(e) => setIssueDate(e.target.value)}
        error={dateError}
        help="Можно указать дату задним числом"
      />

      <div className="preview-box">
        <div className="muted small">Действительно до (рассчитывается автоматически)</div>
        <div className="row" style={{ marginTop: 4 }}>
          <span className="bold">{formatDateRu(expiryPreview)}</span>
          {preview && <StatusBadge status={preview.status} daysLeft={preview.daysLeft} />}
        </div>
      </div>

      {item && <PhotoField item={item} />}

      {save.error ? <Alert>{errorMessage(save.error)}</Alert> : null}
    </Dialog>
  );
}
