import { useState } from 'react';
import type { Paginated, RadarCardDto, UserDto } from '@app/shared';
import { api, errorMessage } from '../../core/api.ts';
import { invalidate, useAction, useQuery } from '../../core/data.ts';
import { useCurrentUser } from '../../core/auth.tsx';
import { Alert, Checkbox, ConfirmDialog, Dialog, PageHeader, Pager, SelectField, TextArea, TextField } from '@app/shared/ui';
import { ViewToggle } from '../../widgets/display';

interface Customer { id: number; name: string }

interface RadarFormValues {
  incidentDate: string;
  customerId: string;
  customerName: string;
  userId: string;
  mainInfo: string;
  event: string;
  actionsTaken: string;
  requiredActions: string;
  stoppedWork: boolean;
}

const empty = (id: number): RadarFormValues => ({
  incidentDate: new Date().toISOString().slice(0, 10),
  customerId: '',
  customerName: '',
  userId: String(id),
  mainInfo: '',
  event: '',
  actionsTaken: '',
  requiredActions: '',
  stoppedWork: false,
});

function RadarForm({ item, open, onClose }: { item?: RadarCardDto; open: boolean; onClose: () => void }) {
  const me = useCurrentUser();
  const [values, setValues] = useState<RadarFormValues>(() => item
    ? {
        incidentDate: item.incidentDate,
        customerId: item.customerId === null ? '' : String(item.customerId),
        customerName: item.customerName,
        userId: String(item.userId),
        mainInfo: item.mainInfo,
        event: item.event,
        actionsTaken: item.actionsTaken,
        requiredActions: item.requiredActions ?? '',
        stoppedWork: item.stoppedWork,
      }
    : empty(me.id));
  const users = useQuery(open ? 'radar:users' : null, () => api.get<UserDto[]>('/radar-cards/users'));
  const customers = useQuery(open ? 'radar:customers' : null, () => api.get<Customer[]>('/radar-cards/customers'));
  const selectedCustomer = customers.data?.find((customer) => String(customer.id) === values.customerId);
  const set = <K extends keyof RadarFormValues>(key: K, value: RadarFormValues[K]) => setValues((current) => ({ ...current, [key]: value }));
  const save = useAction(
    () => {
      const body = {
        ...values,
        customerId: values.customerId ? Number(values.customerId) : null,
        customerName: item ? values.customerName : selectedCustomer?.name ?? '',
        userId: Number(values.userId),
      };
      return item ? api.patch(`/radar-cards/${item.id}`, body) : api.post('/radar-cards', body);
    },
    { onSuccess: () => { invalidate('radar'); onClose(); } },
  );

  return <Dialog
    open={open}
    wide
    title={item ? 'Редактирование карты радар' : 'Новая карта радар'}
    onClose={onClose}
    onSubmit={() => save.run()}
    actions={<><button type="button" className="btn" onClick={onClose}>Отмена</button><button type="submit" className="btn btn-primary" disabled={save.pending || (!item && !values.customerId)}>Сохранить</button></>}
  >
    <TextField label="Дата инцидента *" type="date" value={values.incidentDate} onChange={(event) => set('incidentDate', event.target.value)} />
    <SelectField label="Заказчик *" value={values.customerId} onChange={(event) => set('customerId', event.target.value)}>
      {item?.customerId === null
        ? <option value="">Не сопоставлен — {item.customerName}</option>
        : <option value="">Выберите заказчика</option>}
      {item?.customer && !customers.data?.some((customer) => customer.id === item.customerId)
        ? <option value={item.customer.id}>{item.customer.name} (архив)</option>
        : null}
      {(customers.data ?? []).map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
    </SelectField>
    <SelectField label="Инициатор" value={values.userId} onChange={(event) => set('userId', event.target.value)} disabled={!!item}>
      {users.data?.map((user) => <option key={user.id} value={user.id}>{user.fullName}</option>)}
    </SelectField>
    <TextArea label="Основная информация *" rows={3} value={values.mainInfo} onChange={(event) => set('mainInfo', event.target.value)} />
    <TextArea label="Что произошло *" rows={4} value={values.event} onChange={(event) => set('event', event.target.value)} />
    <TextArea label="Мои действия *" rows={4} value={values.actionsTaken} onChange={(event) => set('actionsTaken', event.target.value)} />
    <Checkbox label="Остановил работу" checked={values.stoppedWork} onChange={(value) => set('stoppedWork', value)} />
    <TextArea label="Необходимые действия" rows={3} value={values.requiredActions} onChange={(event) => set('requiredActions', event.target.value)} />
    {save.error ? <Alert>{errorMessage(save.error)}</Alert> : null}
  </Dialog>;
}

export function RadarCardsPage() {
  const me = useCurrentUser();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [previousMonth, setPreviousMonth] = useState(false);
  const [page, setPage] = useState(1);
  const [mode, setMode] = useState<'cards' | 'table'>('cards');
  const [form, setForm] = useState<{ open: boolean; item?: RadarCardDto }>({ open: false });
  const [removeId, setRemoveId] = useState<number | null>(null);
  const { data, error } = useQuery(`radar:${from}:${to}:${previousMonth}:${page}`, () => api.get<Paginated<RadarCardDto>>('/radar-cards', { from, to, previousMonth, page, pageSize: 20 }));
  const remove = useAction((id: number) => api.delete(`/radar-cards/${id}`), { onSuccess: () => { invalidate('radar'); setRemoveId(null); } });
  const canEdit = (item: RadarCardDto) => item.userId === me.id;
  const customerName = (item: RadarCardDto) => item.customer?.name ?? item.customerName;

  return <>
    <PageHeader title="Учёт карт радар" actions={<><ViewToggle value={mode} onChange={setMode} cardsFirst tableLabel="Список" showIcons={false} /><button type="button" className="btn btn-primary" onClick={() => setForm({ open: true })}>Создать карту</button></>} />
    {error && <Alert>{error}</Alert>}
    <div className="panel radar-filters">
      <div className="row wrap">
        <TextField label="С даты" type="date" value={from} onChange={(event) => { setFrom(event.target.value); setPage(1); }} />
        <TextField label="По дату" type="date" value={to} onChange={(event) => { setTo(event.target.value); setPage(1); }} />
        <button type="button" className="btn" onClick={() => { setPreviousMonth((value) => !value); setFrom(''); setTo(''); }}>Прошедший месяц</button>
      </div>
    </div>
    {mode === 'table'
      ? <div className="panel table-wrap"><table className="table"><thead><tr><th>Дата</th><th>Заказчик</th><th>Инициатор</th><th>Событие</th><th>Действия</th></tr></thead><tbody>
        {data?.items.map((item) => <tr key={item.id}>
          <td>{item.incidentDate}</td><td>{customerName(item)}</td><td>{item.user?.fullName}</td><td>{item.event}</td>
          <td><button type="button" className="btn btn-sm" onClick={() => setForm({ open: true, item })}>Просмотр/изменить</button><button type="button" className="btn btn-sm btn-outline danger" onClick={() => setRemoveId(item.id)}>Удалить</button></td>
        </tr>)}
      </tbody></table></div>
      : <div className="stack">{data?.items.map((item) => <article className="panel radar-card" key={item.id}>
        <div className="row between"><strong>{item.incidentDate}</strong><span>{item.stoppedWork ? 'Работа остановлена' : 'Работа не остановлена'}</span></div>
        <div className="pre">{item.event}</div>
        <div className="muted small">{item.user?.fullName} · {customerName(item)}</div>
        <button type="button" className="btn btn-sm" onClick={() => setForm({ open: true, item })}>{canEdit(item) ? 'Просмотр/изменить' : 'Просмотр'}</button>
        <button type="button" className="btn btn-sm btn-outline danger" onClick={() => setRemoveId(item.id)}>Удалить</button>
      </article>)}</div>}
    <Pager total={data?.total ?? 0} page={page} pageSize={20} sizes={[20]} onPage={setPage} onPageSize={() => {}} />
    {form.open && <RadarForm key={form.item?.id ?? 'new'} open={form.open} item={form.item} onClose={() => setForm({ open: false })} />}
    <ConfirmDialog open={removeId !== null} title="Удалить карту радар?" text="Запись будет удалена." confirmText="Удалить" danger disabled={remove.pending} onConfirm={() => removeId !== null && remove.run(removeId)} onClose={() => setRemoveId(null)} />
  </>;
}
