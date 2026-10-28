import { useState } from 'react';
import type { NotificationDto, Paginated } from '@app/shared';
import { Icon, StatusIcon, useClickOutside } from '@app/shared/ui';
import { api } from '../../core/api.ts';
import { useCurrentUser } from '../../core/auth.tsx';
import { useQuery } from '../../core/data.ts';
import { useRouter } from '../../core/router.tsx';
import { formatDateTime } from '../../core/utils.ts';
import { dismissRead, markAllRead, markRead } from './notificationActions';

export function NotificationIcon({ notification }: { notification: NotificationDto }) {
  if (notification.kind === 'MESSAGE') return <Icon name="mail" className="c-blue" />;
  return <StatusIcon status={notification.level ?? 'YELLOW'} />;
}

export function NotificationBell() {
  const user = useCurrentUser();
  const { navigate } = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useClickOutside(open, () => setOpen(false));

  const unread = useQuery('notifications:unread', () => api.get<{ count: number }>('/me/notifications/unread-count'), {
    refreshMs: 60_000,
  });
  const latest = useQuery(open ? 'notifications:latest' : null, () =>
    api.get<Paginated<NotificationDto>>('/me/notifications', { pageSize: 8 }),
  );

  const allPath = user.role === 'ADMIN' ? '/admin/notifications' : '/user/notifications';
  const count = unread.data?.count ?? 0;

  const goToNotification = (notification: NotificationDto) => {
    markRead(notification).catch(() => {});
    setOpen(false);
    navigate(notification.link ?? allPath);
  };

  return (
    <div className="anchor" ref={ref}>
      <button
        type="button"
        className={`icon-btn lg${count > 0 ? ' alert' : ''}`}
        title="Уведомления"
        aria-label={`Уведомления, непрочитанных: ${count}`}
        onClick={() => setOpen((current) => !current)}
      >
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
            {latest.data?.items.map((notification) => (
              <button key={notification.id} type="button" className={`note${notification.readAt ? '' : ' unread'}`} onClick={() => goToNotification(notification)}>
                <NotificationIcon notification={notification} />
                <span className="grow">
                  <span className="note-title">{notification.title}</span>
                  <span className="muted small" style={{ display: 'block' }}>
                    {formatDateTime(notification.createdAt)}
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
