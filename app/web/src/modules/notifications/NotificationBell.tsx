import { useState } from 'react';
import type { NotificationDto, Paginated } from '@app/shared';
import { api } from '../../core/api.ts';
import { useCurrentUser } from '../../core/auth.tsx';
import { invalidate, useQuery } from '../../core/data.ts';
import { useRouter } from '../../core/router.tsx';
import { formatDateTime } from '../../core/utils.ts';
import { Icon, StatusIcon, useClickOutside } from '@app/shared/ui';

export function NotificationIcon({ n }: { n: NotificationDto }) {
  if (n.kind === 'MESSAGE') return <Icon name="mail" className="c-blue" />;
  return <StatusIcon status={n.level ?? 'YELLOW'} />;
}

export async function markRead(n: NotificationDto) {
  if (n.readAt) return;
  await api.patch(`/me/notifications/${n.id}/read`);
  invalidate('notifications');
}

export async function markAllRead() {
  await api.post('/me/notifications/read-all');
  invalidate('notifications');
}

/** Убрать прочитанные из списка. */
export async function dismissRead() {
  await api.post('/me/notifications/dismiss-read');
  invalidate('notifications');
}

export function NotificationBell() {
  const user = useCurrentUser();
  const { navigate } = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useClickOutside(open, () => setOpen(false));

  // Счётчик непрочитанных обновляется раз в минуту
  const unread = useQuery('notifications:unread', () => api.get<{ count: number }>('/me/notifications/unread-count'), {
    refreshMs: 60_000,
  });
  const latest = useQuery(open ? 'notifications:latest' : null, () =>
    api.get<Paginated<NotificationDto>>('/me/notifications', { pageSize: 8 }),
  );

  const allPath = user.role === 'ADMIN' ? '/admin/notifications' : '/user/notifications';
  const count = unread.data?.count ?? 0;

  const go = (n: NotificationDto) => {
    markRead(n).catch(() => {});
    setOpen(false);
    navigate(n.link ?? allPath);
  };

  return (
    <div className="anchor" ref={ref}>
      <button type="button" className={`icon-btn lg${count > 0 ? ' alert' : ''}`} title="Уведомления" aria-label={`Уведомления, непрочитанных: ${count}`} onClick={() => setOpen((v) => !v)}>
        <Icon name="bell" />
        {count > 0 && <span className="count-badge">{count > 99 ? '99+' : count}</span>}
      </button>
      {open && (
        <div className="popover">
          <div className="popover-head notif-head">
            <div className="row">
              <span className="bold">Уведомления</span>
              {count > 0 && <span className="new-count">{count} новых</span>}
            </div>
            <div className="row">
              <button
                type="button"
                className="icon-btn tip"
                data-tip="Прочитать все"
                aria-label="Прочитать все"
                disabled={count === 0}
                onClick={() => markAllRead().catch(() => {})}
              >
                <Icon name="doneAll" />
              </button>
              <button
                type="button"
                className="icon-btn tip"
                data-tip="Очистить прочитанные"
                aria-label="Очистить прочитанные"
                onClick={() => dismissRead().catch(() => {})}
              >
                <Icon name="clearAll" />
              </button>
            </div>
          </div>
          <div className="popover-body">
            {latest.data?.items.length === 0 && <div className="empty">Уведомлений нет</div>}
            {latest.data?.items.map((n) => (
              <button key={n.id} type="button" className={`note${n.readAt ? '' : ' unread'}`} onClick={() => go(n)}>
                <NotificationIcon n={n} />
                <span className="grow">
                  <span className="note-title">{n.title}</span>
                  <span className="muted small" style={{ display: 'block' }}>
                    {formatDateTime(n.createdAt)}
                  </span>
                </span>
              </button>
            ))}
          </div>
          <div className="popover-foot">
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => {
                setOpen(false);
                navigate(allPath);
              }}
            >
              Все уведомления
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
