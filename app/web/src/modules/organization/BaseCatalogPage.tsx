import { useState } from 'react';
import { api } from '../../core/api.ts';
import { invalidate, useAction, useQuery } from '../../core/data.ts';
import { Alert, PageHeader, TextField } from '@app/shared/ui';
import { ActionError } from '../../widgets/feedback/ActionError';

interface BaseItem { id: number; name: string; code: string | null; isActive: boolean }

export function BaseCatalogPage() {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [edits, setEdits] = useState<Record<number, { name: string; code: string }>>({});
  const { data = [], error } = useQuery('org:bases', () => api.get<BaseItem[]>('/org/bases'));
  const refresh = () => invalidate('org:bases');
  const create = useAction(() => api.post('/admin/org/bases', { name: name.trim(), code: code.trim() || null }), {
    onSuccess: () => { setName(''); setCode(''); refresh(); },
  });
  const update = useAction((base: BaseItem) => api.patch(`/admin/org/bases/${base.id}`, base), { onSuccess: refresh });

  return <>
    <PageHeader title="Справочник баз" subtitle="Организационные базы и их активность" />
    {error && <Alert>{error}</Alert>}
    <ActionError error={create.error} />
    <form className="panel row wrap" style={{ padding: 16, alignItems: 'flex-end', marginBottom: 16 }} onSubmit={(event) => {
      event.preventDefault();
      if (name.trim()) create.run();
    }}>
      <TextField label="Название базы" value={name} onChange={(event) => setName(event.target.value)} />
      <TextField label="Код" value={code} onChange={(event) => setCode(event.target.value)} />
      <button className="btn btn-primary" disabled={create.pending || !name.trim()}>Добавить базу</button>
    </form>
    <div className="panel table-wrap">
      <table className="table">
        <thead><tr><th>Название</th><th>Код</th><th>Статус</th><th /></tr></thead>
        <tbody>{data.map((base) => {
          const edit = edits[base.id] ?? { name: base.name, code: base.code ?? '' };
          return <tr key={base.id}>
          <td><input className="input" aria-label={`Название базы ${base.name}`} value={edit.name} onChange={(event) => setEdits((current) => ({ ...current, [base.id]: { ...edit, name: event.target.value } }))} /></td>
          <td><input className="input" aria-label={`Код базы ${base.name}`} value={edit.code} onChange={(event) => setEdits((current) => ({ ...current, [base.id]: { ...edit, code: event.target.value } }))} /></td>
          <td>{base.isActive ? 'Активна' : 'В архиве'}</td>
          <td className="actions">
            <button type="button" className="btn" disabled={update.pending} onClick={() => update.run({ ...base, ...edit, code: edit.code || null })}>Сохранить</button>
            <button type="button" className="btn" disabled={update.pending} onClick={() => update.run({ ...base, ...edit, code: edit.code || null, isActive: !base.isActive })}>{base.isActive ? 'В архив' : 'Восстановить'}</button>
          </td>
        </tr>})}</tbody>
      </table>
      <ActionError error={update.error} />
    </div>
  </>;
}
