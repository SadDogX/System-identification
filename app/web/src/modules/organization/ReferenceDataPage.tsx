import { useState } from 'react';
import { api, errorMessage } from '../../core/api.ts';
import { invalidate, useAction, useQuery } from '../../core/data.ts';
import { Alert, Checkbox, PageHeader, SelectField, TextField } from '@app/shared/ui';

type StatusCategory = 'assignment' | 'contract' | 'addendum' | 'work';
interface StatusItem { id: number; code: string; name: string; sortOrder: number; isActive: boolean; allowsWork?: boolean }
interface Customer { id: number; name: string; code: string | null; isActive: boolean }
interface WorkType { id: number; code: string; name: string; requiresContractPermission: boolean; isActive: boolean }

const CATEGORY_LABELS: Record<StatusCategory, string> = {
  assignment: 'Назначения', contract: 'Договоры', addendum: 'Допсоглашения', work: 'Выполнение работ',
};

export function ReferenceDataPage() {
  const [category, setCategory] = useState<StatusCategory>('assignment');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [sortOrder, setSortOrder] = useState('0');
  const [allowsWork, setAllowsWork] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerCode, setCustomerCode] = useState('');
  const [workTypeName, setWorkTypeName] = useState('');
  const [workTypeCode, setWorkTypeCode] = useState('');
  const [requiresPermission, setRequiresPermission] = useState(true);
  const [statusEdits, setStatusEdits] = useState<Record<string, { name: string; sortOrder: number; isActive: boolean; allowsWork: boolean }>>({});
  const [customerEdits, setCustomerEdits] = useState<Record<number, { name: string; code: string }>>({});
  const [workTypeEdits, setWorkTypeEdits] = useState<Record<number, { name: string; requiresContractPermission: boolean }>>({});

  const statuses = useQuery(`admin:dictionary:status:${category}`, () => api.get<StatusItem[]>(`/org/statuses/${category}`));
  const customers = useQuery('admin:dictionary:customers', () => api.get<Customer[]>('/admin/org/customers'));
  const workTypes = useQuery('admin:dictionary:work-types', () => api.get<WorkType[]>('/admin/org/work-types'));
  const refresh = () => invalidate('admin:dictionary:');

  const createStatus = useAction(() => api.post('/admin/org/statuses', {
    category, code: code.trim().toUpperCase(), name: name.trim(), sortOrder: Number(sortOrder), allowsWork,
  }), { onSuccess: () => { setCode(''); setName(''); refresh(); } });
  const updateStatus = useAction((item: StatusItem) => api.patch(`/admin/org/statuses/${category}/${item.id}`, item), { onSuccess: refresh });
  const createCustomer = useAction(() => api.post('/org/customers', { name: customerName.trim(), code: customerCode.trim() || null }), {
    onSuccess: () => { setCustomerName(''); setCustomerCode(''); refresh(); },
  });
  const updateCustomer = useAction((item: Customer) => api.patch(`/admin/org/customers/${item.id}`, {
    ...item, ...(customerEdits[item.id] ?? {}), code: customerEdits[item.id]?.code || null,
  }), { onSuccess: refresh });
  const createWorkType = useAction(() => api.post('/admin/org/work-types', {
    code: workTypeCode.trim().toUpperCase(), name: workTypeName.trim(), requiresContractPermission: requiresPermission,
  }), { onSuccess: () => { setWorkTypeName(''); setWorkTypeCode(''); refresh(); } });
  const updateWorkType = useAction((item: WorkType) => api.patch(`/admin/org/work-types/${item.id}`, {
    ...item, ...(workTypeEdits[item.id] ?? {}),
  }), { onSuccess: refresh });

  return <>
    <PageHeader title="Справочники организации" subtitle="Статусы, заказчики и виды работ" />
    <section className="panel" style={{ padding: 18, marginBottom: 16 }}>
      <h2 className="section-title">Статусы</h2>
      <div style={{ maxWidth: 360, marginBottom: 16 }}>
        <SelectField label="Справочник статусов" value={category} onChange={(event) => setCategory(event.target.value as StatusCategory)}>
          {(Object.keys(CATEGORY_LABELS) as StatusCategory[]).map((key) => <option key={key} value={key}>{CATEGORY_LABELS[key]}</option>)}
        </SelectField>
      </div>
      {statuses.error && <Alert>{statuses.error}</Alert>}
      {Boolean(createStatus.error) && <Alert>{errorMessage(createStatus.error)}</Alert>}
      <form className="row wrap" style={{ alignItems: 'flex-end', marginBottom: 16 }} onSubmit={(event) => { event.preventDefault(); if (code.trim() && name.trim()) createStatus.run(); }}>
        <TextField label="Код" value={code} onChange={(event) => setCode(event.target.value)} />
        <TextField label="Название" value={name} onChange={(event) => setName(event.target.value)} />
        <TextField label="Порядок" type="number" value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} />
        {(category === 'contract' || category === 'addendum') && <Checkbox label="Разрешает работы" checked={allowsWork} onChange={setAllowsWork} />}
        <button className="btn btn-primary" disabled={createStatus.pending || !code.trim() || !name.trim()}>Добавить статус</button>
      </form>
      <div className="table-wrap"><table className="table">
        <thead><tr><th>Код</th><th>Название</th><th>Порядок</th>{(category === 'contract' || category === 'addendum') && <th>Работы разрешены</th>}<th>Статус</th><th /></tr></thead>
        <tbody>{(statuses.data ?? []).map((item) => {
          const key = `${category}:${item.id}`;
          const edit = statusEdits[key] ?? { name: item.name, sortOrder: item.sortOrder, isActive: item.isActive, allowsWork: item.allowsWork ?? false };
          return <tr key={item.id}>
            <td>{item.code}</td>
            <td><input className="input" value={edit.name} aria-label={`Статус ${item.code}`} onChange={(event) => setStatusEdits((current) => ({ ...current, [key]: { ...edit, name: event.target.value } }))} /></td>
            <td><input className="input" type="number" value={edit.sortOrder} aria-label={`Порядок ${item.code}`} onChange={(event) => setStatusEdits((current) => ({ ...current, [key]: { ...edit, sortOrder: Number(event.target.value) } }))} /></td>
            {(category === 'contract' || category === 'addendum') && <td><Checkbox label="" checked={edit.allowsWork} onChange={(value) => setStatusEdits((current) => ({ ...current, [key]: { ...edit, allowsWork: value } }))} /></td>}
            <td>{edit.isActive ? 'Активен' : 'Архив'}</td>
            <td className="actions">
              <button type="button" className="btn" disabled={updateStatus.pending} onClick={() => updateStatus.run({ ...item, ...edit })}>Сохранить</button>
              <button type="button" className="btn" disabled={updateStatus.pending} onClick={() => {
                updateStatus.run({ ...item, ...edit, isActive: !edit.isActive });
              }}>{edit.isActive ? 'В архив' : 'Восстановить'}</button>
            </td>
          </tr>;
        })}</tbody>
      </table></div>
      {Boolean(updateStatus.error) && <Alert>{errorMessage(updateStatus.error)}</Alert>}
    </section>

    <section className="panel" style={{ padding: 18, marginBottom: 16 }}>
      <h2 className="section-title">Заказчики</h2>
      {customers.error && <Alert>{customers.error}</Alert>}
      {Boolean(createCustomer.error) && <Alert>{errorMessage(createCustomer.error)}</Alert>}
      <form className="row wrap" style={{ alignItems: 'flex-end', marginBottom: 16 }} onSubmit={(event) => { event.preventDefault(); if (customerName.trim()) createCustomer.run(); }}>
        <TextField label="Новый заказчик" value={customerName} onChange={(event) => setCustomerName(event.target.value)} />
        <TextField label="Код" value={customerCode} onChange={(event) => setCustomerCode(event.target.value)} />
        <button className="btn btn-primary" disabled={createCustomer.pending || !customerName.trim()}>Добавить</button>
      </form>
      <div className="table-wrap"><table className="table"><thead><tr><th>Название</th><th>Код</th><th>Статус</th><th /></tr></thead><tbody>
        {(customers.data ?? []).map((item) => {
          const edit = customerEdits[item.id] ?? { name: item.name, code: item.code ?? '' };
          return <tr key={item.id}>
            <td><input className="input" value={edit.name} onChange={(event) => setCustomerEdits((current) => ({ ...current, [item.id]: { ...edit, name: event.target.value } }))} /></td>
            <td><input className="input" value={edit.code} onChange={(event) => setCustomerEdits((current) => ({ ...current, [item.id]: { ...edit, code: event.target.value } }))} /></td>
            <td>{item.isActive ? 'Активен' : 'Архив'}</td>
            <td className="actions"><button type="button" className="btn" disabled={updateCustomer.pending} onClick={() => updateCustomer.run(item)}>Сохранить</button><button type="button" className="btn" disabled={updateCustomer.pending} onClick={() => updateCustomer.run({ ...item, isActive: !item.isActive })}>{item.isActive ? 'В архив' : 'Восстановить'}</button></td>
          </tr>;
        })}
      </tbody></table></div>
      {Boolean(updateCustomer.error) && <Alert>{errorMessage(updateCustomer.error)}</Alert>}
    </section>

    <section className="panel" style={{ padding: 18 }}>
      <h2 className="section-title">Виды работ</h2>
      {workTypes.error && <Alert>{workTypes.error}</Alert>}
      {Boolean(createWorkType.error) && <Alert>{errorMessage(createWorkType.error)}</Alert>}
      <form className="row wrap" style={{ alignItems: 'flex-end', marginBottom: 16 }} onSubmit={(event) => { event.preventDefault(); if (workTypeName.trim() && workTypeCode.trim()) createWorkType.run(); }}>
        <TextField label="Новый вид работ" value={workTypeName} onChange={(event) => setWorkTypeName(event.target.value)} />
        <TextField label="Код" value={workTypeCode} onChange={(event) => setWorkTypeCode(event.target.value)} />
        <Checkbox label="Требуется разрешение договора" checked={requiresPermission} onChange={setRequiresPermission} />
        <button className="btn btn-primary" disabled={createWorkType.pending || !workTypeName.trim() || !workTypeCode.trim()}>Добавить</button>
      </form>
      <div className="table-wrap"><table className="table"><thead><tr><th>Код</th><th>Название</th><th>Требуется разрешение</th><th>Статус</th><th /></tr></thead><tbody>
        {(workTypes.data ?? []).map((item) => {
          const edit = workTypeEdits[item.id] ?? { name: item.name, requiresContractPermission: item.requiresContractPermission };
          return <tr key={item.id}>
            <td>{item.code}</td><td><input className="input" value={edit.name} onChange={(event) => setWorkTypeEdits((current) => ({ ...current, [item.id]: { ...edit, name: event.target.value } }))} /></td>
            <td><Checkbox label="" checked={edit.requiresContractPermission} onChange={(value) => setWorkTypeEdits((current) => ({ ...current, [item.id]: { ...edit, requiresContractPermission: value } }))} /></td>
            <td>{item.isActive ? 'Активен' : 'Архив'}</td>
            <td className="actions"><button type="button" className="btn" disabled={updateWorkType.pending} onClick={() => updateWorkType.run(item)}>Сохранить</button><button type="button" className="btn" disabled={updateWorkType.pending} onClick={() => updateWorkType.run({ ...item, isActive: !item.isActive })}>{item.isActive ? 'В архив' : 'Восстановить'}</button></td>
          </tr>;
        })}
      </tbody></table></div>
      {Boolean(updateWorkType.error) && <Alert>{errorMessage(updateWorkType.error)}</Alert>}
    </section>
  </>;
}
