import { useEffect, useState } from 'react';
import { positionSchema, type PositionDto } from '@app/shared';
import { api, errorMessage } from '../../api.ts';
import { Icon } from '../../components/Icon.tsx';
import { Alert, Checkbox, ConfirmDialog, Dialog, PageHeader, TextField } from '../../components/ui.tsx';
import { invalidate, useAction, useQuery } from '../../data.ts';
import { useForm } from '../../form.ts';
import { Link } from '../../router.tsx';

function PositionDialog({ open, item, onClose }: { open: boolean; item: PositionDto | null; onClose: () => void }) {
  const form = useForm({ name: '', sortOrder: '0' });
  const { reset } = form;

  useEffect(() => {
    if (open) reset({ name: item?.name ?? '', sortOrder: String(item?.sortOrder ?? 0) });
  }, [open, item, reset]);

  const save = useAction((data: unknown) => (item ? api.put(`/admin/positions/${item.id}`, data) : api.post('/admin/positions', data)), {
    onSuccess: () => {
      invalidate('admin');
      onClose();
    },
    onError: (err) => form.applyServerErrors(err),
  });

  return (
    <Dialog
      open={open}
      title={item ? 'Изменить должность' : 'Новая должность'}
      onClose={onClose}
      onSubmit={() => {
        const data = form.validate(positionSchema);
        if (data) save.run(data);
      }}
      actions={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Отмена
          </button>
          <button type="submit" className="btn btn-primary" disabled={save.pending}>
            Сохранить
          </button>
        </>
      }
    >
      <TextField label="Название *" {...form.field('name')} />
      <TextField label="Порядок в списке" type="number" min={0} {...form.field('sortOrder')} />
      {item && item.usersCount > 0 && <Alert kind="info">Новое название сразу появится у всех сотрудников с этой должностью ({item.usersCount}).</Alert>}
      {save.error && !Object.values(form.errors).some(Boolean) ? <Alert>{errorMessage(save.error)}</Alert> : null}
    </Dialog>
  );
}

export function PositionsPage() {
  const [showArchived, setShowArchived] = useState(false);
  const [dialog, setDialog] = useState<{ open: boolean; item: PositionDto | null }>({ open: false, item: null });
  const [archiveTarget, setArchiveTarget] = useState<PositionDto | null>(null);

  const { data = [], error } = useQuery(`admin:positions:${showArchived ? 'all' : 'active'}`, () =>
    api.get<PositionDto[]>('/admin/positions', { archived: showArchived }),
  );

  const toggle = useAction((item: PositionDto) => api.post(`/admin/positions/${item.id}/${item.isArchived ? 'unarchive' : 'archive'}`), {
    onSuccess: () => {
      invalidate('admin');
      setArchiveTarget(null);
    },
  });

  return (
    <>
      <PageHeader
        title="Справочник должностей"
        subtitle="Должность выбирается из этого списка в карточке сотрудника"
        actions={
          <>
            <Checkbox label="Показать архив" checked={showArchived} onChange={setShowArchived} />
            <button type="button" className="btn btn-primary" onClick={() => setDialog({ open: true, item: null })}>
              <Icon name="add" small /> Добавить
            </button>
          </>
        }
      />
      {error && <Alert>{error}</Alert>}
      <div className="panel table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Должность</th>
              <th>Сотрудников</th>
              <th>Порядок</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data.map((item) => (
              <tr key={item.id} className={item.isArchived ? 'dimmed' : ''}>
                <td>
                  {item.name} {item.isArchived && <span className="chip small">В архиве</span>}
                </td>
                <td>{item.usersCount > 0 ? <Link to={`/admin/users?position=${item.id}`}>{item.usersCount}</Link> : '—'}</td>
                <td>{item.sortOrder}</td>
                <td className="actions">
                  <button type="button" className="icon-btn" title="Изменить" aria-label="Изменить" onClick={() => setDialog({ open: true, item })}>
                    <Icon name="edit" />
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    title={item.isArchived ? 'Вернуть из архива' : 'В архив'}
                    aria-label={item.isArchived ? 'Вернуть из архива' : 'В архив'}
                    onClick={() => {
                      toggle.reset();
                      setArchiveTarget(item);
                    }}
                  >
                    <Icon name={item.isArchived ? 'unarchive' : 'archive'} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.length === 0 && <div className="empty">Справочник пуст. Добавьте первую должность.</div>}
      </div>
      <PositionDialog open={dialog.open} item={dialog.item} onClose={() => setDialog({ open: false, item: null })} />
      <ConfirmDialog
        open={!!archiveTarget}
        title={archiveTarget?.isArchived ? 'Вернуть из архива?' : 'Переместить в архив?'}
        text={
          archiveTarget?.isArchived
            ? `«${archiveTarget.name}» снова можно будет выбрать в карточке сотрудника.`
            : `«${archiveTarget?.name}» больше не будет предлагаться при выборе. У сотрудников, которым она уже назначена, должность останется.`
        }
        confirmText={archiveTarget?.isArchived ? 'Вернуть' : 'В архив'}
        danger={!archiveTarget?.isArchived}
        disabled={toggle.pending}
        onConfirm={() => archiveTarget && toggle.run(archiveTarget)}
        onClose={() => setArchiveTarget(null)}
      >
        {toggle.error ? <Alert>{errorMessage(toggle.error)}</Alert> : null}
      </ConfirmDialog>
    </>
  );
}
