import { useState } from 'react';
import type { Paginated, RadarCardDto, UserDto } from '@app/shared';
import { api, errorMessage } from '../../core/api.ts';
import { invalidate, useAction, useQuery } from '../../core/data.ts';
import { useCurrentUser } from '../../core/auth.tsx';
import { PageHeader, Alert, Checkbox, Dialog, Pager, SelectField, TextArea, TextField } from '@app/shared/ui';

const CUSTOMERS = ['ООО «Стройинвест»', 'АО «Промстрой»', 'ООО «Северный объект»', 'ООО «ЭнергоСервис»'];
const empty = (userId: number) => ({ incidentDate: new Date().toISOString().slice(0, 10), customerName: CUSTOMERS[0], userId: String(userId), mainInfo: '', event: '', actionsTaken: '', requiredActions: '', stoppedWork: false });

function CardForm({ open, onClose }: { open: boolean; onClose: () => void }) {
  const current = useCurrentUser(); const [values, setValues] = useState(empty(current.id)); const users = useQuery(open ? 'radar:users' : null, () => api.get<UserDto[]>('/radar-cards/users'));
  const set = <K extends keyof typeof values>(key: K, value: (typeof values)[K]) => setValues((v) => ({ ...v, [key]: value }));
  const save = useAction(() => api.post<RadarCardDto>('/radar-cards', { ...values, userId: Number(values.userId) }), { onSuccess: () => { invalidate('radar'); onClose(); setValues(empty(current.id)); } });
  return <Dialog open={open} wide title="Новая карта радар" onClose={onClose} onSubmit={() => save.run()} actions={<><button type="button" className="btn" onClick={onClose}>Отмена</button><button type="submit" className="btn btn-primary" disabled={save.pending}>Создать</button></>}>
    <TextField label="Дата инцидента *" type="date" value={values.incidentDate} onChange={(e) => set('incidentDate', e.target.value)} />
    <SelectField label="Заказчик на объекте *" value={values.customerName} onChange={(e) => set('customerName', e.target.value)}>{CUSTOMERS.map((customer) => <option key={customer}>{customer}</option>)}</SelectField>
    <SelectField label="Инициатор *" value={values.userId} onChange={(e) => set('userId', e.target.value)}>{users.data?.map((user) => <option key={user.id} value={user.id}>{user.fullName} ({user.login})</option>)}</SelectField>
    <TextArea label="Основная информация *" rows={3} value={values.mainInfo} onChange={(e) => set('mainInfo', e.target.value)} />
    <TextArea label="Что произошло *" rows={4} value={values.event} onChange={(e) => set('event', e.target.value)} />
    <TextArea label="Мои действия *" rows={4} value={values.actionsTaken} onChange={(e) => set('actionsTaken', e.target.value)} />
    <Checkbox label="Остановил работу" checked={values.stoppedWork} onChange={(value) => set('stoppedWork', value)} />
    <TextArea label="Если не смог повлиять, какие действия необходимо провести" rows={4} value={values.requiredActions} onChange={(e) => set('requiredActions', e.target.value)} />
    {save.error ? <Alert>{errorMessage(save.error)}</Alert> : null}
  </Dialog>;
}

function Card({ item }: { item: RadarCardDto }) {
  return <article className="panel radar-card"><div className="row between"><strong>{new Date(item.incidentDate).toLocaleDateString('ru-RU')}</strong><span className="muted small">{item.stoppedWork ? 'Работа остановлена' : 'Работа не остановлена'}</span></div><div className="stack tight"><div><b>Заказчик</b><div>{item.customerName}</div></div>{item.user && <div><b>Инициатор</b><div>{item.user.fullName} ({item.user.login})</div></div>}<div><b>Основная информация</b><div className="pre">{item.mainInfo}</div></div><div><b>Событие</b><div className="pre">{item.event}</div></div><div><b>Мои действия</b><div className="pre">{item.actionsTaken}</div></div>{item.requiredActions && <div><b>Необходимые действия</b><div className="pre">{item.requiredActions}</div></div>}</div></article>;
}

export function RadarCardsPage() {
  const [from, setFrom] = useState(''); const [to, setTo] = useState(''); const [previousMonth, setPreviousMonth] = useState(false); const [page, setPage] = useState(1); const [open, setOpen] = useState(false);
  const { data, error } = useQuery(`radar:${from}:${to}:${previousMonth}:${page}`, () => api.get<Paginated<RadarCardDto>>('/radar-cards', { from, to, previousMonth, page, pageSize:20 }));
  const update = (setter: (v: string) => void, value: string) => { setter(value); setPreviousMonth(false); setPage(1); };
  return <><PageHeader title="Учёт карт радар" subtitle="Общие карты безопасности всех сотрудников" actions={<button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>Создать карту</button>} /><div className="panel radar-filters"><div className="row wrap" style={{ alignItems:'flex-end' }}><TextField label="С даты" type="date" value={from} onChange={(e) => update(setFrom, e.target.value)} /><TextField label="По дату" type="date" value={to} onChange={(e) => update(setTo, e.target.value)} /><button type="button" className={`btn${previousMonth ? ' btn-primary' : ''}`} onClick={() => { setPreviousMonth((v) => !v); setFrom(''); setTo(''); setPage(1); }}>Прошедший месяц</button></div></div>{error && <Alert>{error}</Alert>}<div className="stack radar-list">{data?.items.map((item) => <Card key={item.id} item={item} />)}{data?.items.length === 0 && <div className="empty">Карт радар не найдено</div>}</div><Pager total={data?.total ?? 0} page={page} pageSize={20} sizes={[20]} onPage={setPage} onPageSize={() => {}} /><CardForm open={open} onClose={() => setOpen(false)} /></>;
}
