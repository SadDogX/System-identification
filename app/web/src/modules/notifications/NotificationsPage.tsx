import { useState } from 'react';
import type { NotificationDto, Paginated } from '@app/shared';
import { api } from '../../core/api.ts';
import { Alert, ConfirmDialog, PageHeader, Pager, Icon } from '@app/shared/ui';
import { useQuery } from '../../core/data.ts';
import { useRouter } from '../../core/router.tsx';
import { formatDateTime } from '../../core/utils.ts';
import { NotificationIcon } from '../../widgets/notifications/NotificationBell';
import { dismissRead, markAllRead, markRead } from '../../widgets/notifications/notificationActions';

type Kind = 'ALL' | 'EXPIRY' | 'MESSAGE';
const TABS: { value: Kind; label: string }[] = [
  { value: 'ALL', label: 'Все' },
  { value: 'EXPIRY', label: 'Сроки' },
  { value: 'MESSAGE', label: 'Сообщения' },
];

export function NotificationsPage() {
  const { navigate } = useRouter();
  const [kind, setKind] = useState<Kind>('ALL');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [confirmDismiss, setConfirmDismiss] = useState(false);

  const { data, error } = useQuery(`notifications:list:${kind}:${page}:${pageSize}`, () =>
    api.get<Paginated<NotificationDto>>('/me/notifications', { page, pageSize, kind: kind === 'ALL' ? undefined : kind }),
  );

  const open = (n: NotificationDto) => {
    markRead(n).catch(() => {});
    // Сообщение раскрываем на месте, остальные ведут на нужную страницу
    if (n.kind === 'MESSAGE' || !n.link) setExpanded(expanded === n.id ? null : n.id);
    else navigate(n.link);
  };

  return (
    <>
      <PageHeader
        title="Уведомления"
        actions={
          <>
            <button type="button" className="btn btn-outline" onClick={() => markAllRead().catch(() => {})}>
              Отметить все как прочитанные
            </button>
            <button type="button" className="btn btn-outline" onClick={() => setConfirmDismiss(true)}>
              <Icon name="clearAll" small /> Очистить прочитанные
            </button>
          </>
        }
      />
      {error && <Alert>{error}</Alert>}
      <div className="panel">
        <div className="tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={kind === t.value}
              className={`tab${kind === t.value ? ' active' : ''}`}
              onClick={() => {
                setKind(t.value);
                setPage(1);
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
        {data?.items.length === 0 && <div className="empty">Уведомлений нет</div>}
        {data?.items.map((n) => (
          <button key={n.id} type="button" className={`note${n.readAt ? '' : ' unread'}`} onClick={() => open(n)}>
            <NotificationIcon notification={n} />
            <span className="grow">
              <span className="row wrap">
                <span className="note-title">{n.title}</span>
                {!n.readAt && <span className="chip small primary">Новое</span>}
              </span>
              {(expanded === n.id || n.kind !== 'MESSAGE') && <span className="pre" style={{ display: 'block', margin: '4px 0' }}>{n.body}</span>}
              <span className="muted small">{formatDateTime(n.createdAt)}</span>
            </span>
          </button>
        ))}
        <ConfirmDialog
          open={confirmDismiss}
          title="Очистить прочитанные?"
          text="Все прочитанные уведомления и сообщения будут убраны из списка. Непрочитанные останутся."
          confirmText="Очистить"
          onConfirm={() => {
            setConfirmDismiss(false);
            setPage(1);
            dismissRead().catch(() => {});
          }}
          onClose={() => setConfirmDismiss(false)}
        />
        {data && data.total > 0 && (
          <Pager
            total={data.total}
            page={page}
            pageSize={pageSize}
            sizes={[20, 50, 100]}
            onPage={setPage}
            onPageSize={(s) => {
              setPageSize(s);
              setPage(1);
            }}
          />
        )}
      </div>
    </>
  );
}
