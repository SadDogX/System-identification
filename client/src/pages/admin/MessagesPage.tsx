import { useEffect, useState } from 'react';
import { sendMessageSchema, type MessageDto, type Paginated } from '@app/shared';
import { api, errorMessage } from '../../api.ts';
import { Icon } from '../../components/Icon.tsx';
import { Alert, PageHeader, Pager, SelectField, TextArea, TextField } from '../../components/ui.tsx';
import { invalidate, useAction, useQuery } from '../../data.ts';
import { useForm } from '../../form.ts';
import { formatDateTime } from '../../utils.ts';
import { takeMessageDraft } from '../../messageDraft.ts';

interface UserOption {
  id: number;
  fullName: string;
  login: string;
}

export function MessagesPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const form = useForm({ recipient: 'user', userId: '', subject: '', body: '' });
  const { reset } = form;

  // Черновик из карточки сотрудника: получатель, тема и текст уже заполнены
  useEffect(() => {
    const draft = takeMessageDraft();
    if (draft) reset({ recipient: 'user', userId: String(draft.userId), subject: draft.subject, body: draft.body });
  }, [reset]);

  const options = useQuery('admin:user-options', () => api.get<UserOption[]>('/admin/users/options'));
  const history = useQuery(`admin:messages:${page}:${pageSize}`, () => api.get<Paginated<MessageDto>>('/admin/messages', { page, pageSize }));

  const send = useAction((data: unknown) => api.post<{ recipientsCount: number }>('/admin/messages', data), {
    onSuccess: () => {
      form.reset({ ...form.values, subject: '', body: '' });
      invalidate('admin:messages');
    },
    onError: (err) => form.applyServerErrors(err),
  });
  const [sentTo, setSentTo] = useState<number | null>(null);

  const submit = async () => {
    const { recipient, userId, subject, body } = form.values;
    const payload = { recipient, subject, body, ...(recipient === 'user' && userId && { userId: Number(userId) }) };
    if (!form.validate(sendMessageSchema, payload)) return;
    setSentTo(null);
    const ok = await send.run(payload);
    if (ok) setSentTo(recipient === 'all' ? -1 : Number(userId));
  };

  return (
    <>
      <PageHeader title="Сообщения" subtitle="Сообщение появится в центре уведомлений получателя" />
      <div className="half-cols">
        <form
          noValidate
          className="panel pad-lg stack"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="bold">Новое сообщение</div>
          <div className="row wrap" role="radiogroup" aria-label="Получатель" style={{ gap: 16 }}>
            {[
              ['user', 'Конкретный пользователь'],
              ['all', 'Все пользователи'],
            ].map(([value, label]) => (
              <label key={value} className="check">
                <input type="radio" name="recipient" value={value} checked={form.values.recipient === value} onChange={() => form.set('recipient', value)} />
                {label}
              </label>
            ))}
          </div>
          {form.values.recipient === 'user' ? (
            <SelectField label="Получатель" {...form.field('userId')}>
              <option value="">— выберите сотрудника —</option>
              {options.data?.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.fullName} ({o.login})
                </option>
              ))}
            </SelectField>
          ) : (
            <Alert kind="info">Сообщение получат все активные сотрудники.</Alert>
          )}
          <TextField label="Тема" {...form.field('subject')} />
          <TextArea label="Сообщение" rows={6} {...form.field('body')} />
          {send.done && sentTo !== null && <Alert kind="success">Сообщение отправлено</Alert>}
          {send.error && !Object.values(form.errors).some(Boolean) ? <Alert>{errorMessage(send.error)}</Alert> : null}
          <div>
            <button type="submit" className="btn btn-primary" disabled={send.pending}>
              <Icon name="send" small /> Отправить
            </button>
          </div>
        </form>

        <div className="panel pad">
          <div className="panel-title">Отправленные</div>
          {history.data?.items.length === 0 && <div className="muted">Сообщений пока нет</div>}
          <ul className="list">
            {history.data?.items.map((m) => (
              <li key={m.id}>
                <div className="row wrap">
                  <span className="bold">{m.subject}</span>
                  <span className="chip small">{m.isBroadcast ? 'Всем' : (m.recipient?.fullName ?? 'Лично')}</span>
                </div>
                <div className="pre" style={{ margin: '4px 0' }}>
                  {m.body}
                </div>
                <div className="muted small">
                  {formatDateTime(m.createdAt)} · {m.sender.fullName} · прочитали {m.readCount} из {m.recipientsCount}
                </div>
              </li>
            ))}
          </ul>
          {history.data && history.data.total > pageSize && (
            <Pager
              total={history.data.total}
              page={page}
              pageSize={pageSize}
              sizes={[10, 20, 50]}
              onPage={setPage}
              onPageSize={(s) => {
                setPageSize(s);
                setPage(1);
              }}
            />
          )}
        </div>
      </div>
    </>
  );
}
