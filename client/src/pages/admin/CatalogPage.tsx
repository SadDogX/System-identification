import { useEffect, useState } from 'react';
import { catalogItemSchema, type CatalogItemDto } from '@app/shared';
import { api, errorMessage } from '../../api.ts';
import { Icon } from '../../components/Icon.tsx';
import { Alert, Checkbox, ConfirmDialog, Dialog, PageHeader, TextField } from '../../components/ui.tsx';
import { invalidate, useAction, useQuery } from '../../data.ts';
import { useForm } from '../../form.ts';
import { formatValidity } from '../../utils.ts';

function ItemDialog({ open, item, onClose }: { open: boolean; item: CatalogItemDto | null; onClose: () => void }) {
  const form = useForm({ name: '', validityMonths: '12', sortOrder: '0' });
  const { reset } = form;

  useEffect(() => {
    if (open) reset({ name: item?.name ?? '', validityMonths: String(item?.validityMonths ?? 12), sortOrder: String(item?.sortOrder ?? 0) });
  }, [open, item, reset]);

  const save = useAction((data: unknown) => (item ? api.put(`/admin/catalog/${item.id}`, data) : api.post('/admin/catalog', data)), {
    onSuccess: () => {
      invalidate('admin');
      onClose();
    },
    onError: (err) => form.applyServerErrors(err),
  });

  return (
    <Dialog
      open={open}
      title={item ? 'Изменить удостоверение' : 'Новое удостоверение'}
      onClose={onClose}
      onSubmit={() => {
        const data = form.validate(catalogItemSchema);
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
      <TextField label="Срок действия, месяцев *" type="number" min={1} help="Например, 12 — один год, 36 — три года" {...form.field('validityMonths')} />
      <TextField label="Порядок в списке" type="number" min={0} {...form.field('sortOrder')} />
      {item ? (
        <Alert kind="info">Новый срок применится к датам, которые будут введены после изменения. Уже заполненные даты не пересчитываются.</Alert>
      ) : (
        <Alert kind="info">Удостоверение сразу появится у всех сотрудников со статусом «Не заполнено».</Alert>
      )}
      {save.error && !Object.values(form.errors).some(Boolean) ? <Alert>{errorMessage(save.error)}</Alert> : null}
    </Dialog>
  );
}

export function CatalogPage() {
  const [showArchived, setShowArchived] = useState(false);
  const [dialog, setDialog] = useState<{ open: boolean; item: CatalogItemDto | null }>({ open: false, item: null });
  const [archiveTarget, setArchiveTarget] = useState<CatalogItemDto | null>(null);

  const { data = [], error } = useQuery(`admin:catalog:${showArchived ? 'all' : 'active'}`, () =>
    api.get<CatalogItemDto[]>('/admin/catalog', { archived: showArchived }),
  );

  const toggle = useAction((item: CatalogItemDto) => api.post(`/admin/catalog/${item.id}/${item.isArchived ? 'unarchive' : 'archive'}`), {
    onSuccess: () => {
      invalidate('admin');
      setArchiveTarget(null);
    },
  });

  return (
    <>
      <PageHeader
        title="Справочник удостоверений"
        subtitle="Перечень удостоверений и сроки их действия"
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
              <th>Название</th>
              <th>Срок действия</th>
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
                <td>{formatValidity(item.validityMonths)}</td>
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
        {data.length === 0 && <div className="empty">Справочник пуст. Добавьте первое удостоверение.</div>}
      </div>
      <ItemDialog open={dialog.open} item={dialog.item} onClose={() => setDialog({ open: false, item: null })} />
      <ConfirmDialog
        open={!!archiveTarget}
        title={archiveTarget?.isArchived ? 'Вернуть из архива?' : 'Переместить в архив?'}
        text={
          archiveTarget?.isArchived
            ? `«${archiveTarget.name}» снова появится у всех сотрудников.`
            : `«${archiveTarget?.name}» пропадёт у всех сотрудников из списков и статистики. Введённые данные сохранятся.`
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
