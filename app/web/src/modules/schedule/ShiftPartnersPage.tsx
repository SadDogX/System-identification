import { useState } from 'react';
import type { UserDto } from '@app/shared';
import { api, errorMessage } from '../../core/api.ts';
import { useAction, useQuery, invalidate } from '../../core/data.ts';
import { Alert, PageHeader, SelectField, TextField } from '@app/shared/ui';

export function ShiftPartnersPage() {
  const year = new Date().getFullYear(); const users = useQuery('schedule:users', () => api.get<UserDto[]>('/admin/work-schedule/users'));
  const [values, setValues] = useState({ userAId: '', userBId: '', rotationDays: '5', travelDays: '2' }); const set = (key: keyof typeof values, value: string) => setValues((v) => ({ ...v, [key]: value }));
  const generate = useAction(() => api.post('/admin/work-schedule/shift-partners/generate', { year, ...values, travelDays: Number(values.travelDays) }), { onSuccess: () => invalidate('schedule') });
  return <><PageHeader title="График сменщиков" subtitle={`Генерация графика на ${year} год`} /><div className="panel pad schedule-generator"><div className="form-grid"><SelectField label="Сотрудник A *" value={values.userAId} onChange={(e) => set('userAId', e.target.value)}><option value="">Выберите сотрудника</option>{users.data?.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}</SelectField><SelectField label="Сотрудник B *" value={values.userBId} onChange={(e) => set('userBId', e.target.value)}><option value="">Выберите сотрудника</option>{users.data?.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}</SelectField></div><div className="form-grid"><SelectField label="Ротация" value={values.rotationDays} onChange={(e) => set('rotationDays', e.target.value)}><option value="5">5 / 5 недель</option><option value="4">4 / 4 недели</option></SelectField><TextField label="Дней дороги" type="number" min={1} max={14} value={values.travelDays} onChange={(e) => set('travelDays', e.target.value)} /></div><button type="button" className="btn btn-primary" disabled={generate.pending} onClick={() => generate.run()}>Сгенерировать график</button>{generate.pending && <div className="loader-inline">Выполняется генерация…</div>}{generate.done && <Alert kind="success">График успешно сгенерирован.</Alert>}{generate.error ? <Alert>{errorMessage(generate.error)}</Alert> : null}</div></>;
}
