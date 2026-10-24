import { useState } from 'react';
import type { IfoProposalDto, Paginated } from '@app/shared';
import { api, errorMessage } from '../../core/api.ts';
import { invalidate, useAction, useQuery } from '../../core/data.ts';
import { Alert, Dialog, PageHeader, Pager, TextArea, TextField } from '@app/shared/ui';

export function IfoPage() {
  const [open, setOpen] = useState(false); const [values, setValues] = useState({ title: '', problem: '', proposal: '', expectedBenefit: '' });
  const set = (key: keyof typeof values, value: string) => setValues((v) => ({ ...v, [key]: value }));
  const save = useAction(() => api.post<IfoProposalDto>('/ifo', values), { onSuccess: () => { invalidate('ifo'); setOpen(false); setValues({ title: '', problem: '', proposal: '', expectedBenefit: '' }); } });
  const { data, error } = useQuery('ifo:list', () => api.get<Paginated<IfoProposalDto>>('/ifo', { page: 1, pageSize: 100 }));
  return <>
    <PageHeader title="IFO" subtitle="Система совершенствования: предложения сотрудников по улучшению работы" actions={<button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>Создать предложение</button>} />
    {error && <Alert>{error}</Alert>}
    <div className="stack">{data?.items.map((item) => <article className="panel radar-card" key={item.id}><div className="row between"><h3>{item.title}</h3><span className="muted small">{new Date(item.createdAt).toLocaleDateString('ru-RU')}</span></div><div className="muted small">Автор: {item.proposer?.fullName}</div><div className="stack tight"><div><b>Проблема</b><div className="pre">{item.problem}</div></div><div><b>Предложение</b><div className="pre">{item.proposal}</div></div><div><b>Ожидаемая польза</b><div className="pre">{item.expectedBenefit}</div></div></div></article>)}{data?.items.length === 0 && <div className="empty">Предложений пока нет</div>}</div>
    <Pager total={data?.total ?? 0} page={1} pageSize={100} sizes={[100]} onPage={() => {}} onPageSize={() => {}} />
    <Dialog open={open} wide title="Новое предложение IFO" onClose={() => setOpen(false)} onSubmit={() => save.run()} actions={<><button type="button" className="btn" onClick={() => setOpen(false)}>Отмена</button><button type="submit" className="btn btn-primary" disabled={save.pending}>Создать</button></>}><TextField label="Название предложения *" value={values.title} onChange={(e) => set('title', e.target.value)} /><TextArea label="Проблема или потери *" rows={3} value={values.problem} onChange={(e) => set('problem', e.target.value)} /><TextArea label="Предложение *" rows={4} value={values.proposal} onChange={(e) => set('proposal', e.target.value)} /><TextArea label="Ожидаемая польза *" rows={3} value={values.expectedBenefit} onChange={(e) => set('expectedBenefit', e.target.value)} />{save.error ? <Alert>{errorMessage(save.error)}</Alert> : null}</Dialog>
  </>;
}
