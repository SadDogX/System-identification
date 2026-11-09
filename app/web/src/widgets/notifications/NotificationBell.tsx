import { useState } from 'react';
import type { NotificationDto, Paginated } from '@app/shared';
import { Icon, StatusIcon, useClickOutside } from '@app/shared/ui';
import { api } from '../../core/api.ts';
import { useCurrentUser } from '../../core/auth.tsx';
import { useQuery } from '../../core/data.ts';
import { useRouter } from '../../core/router.tsx';
import { useLanguage } from '../../core/i18n.tsx';
import { APP_MESSAGES, appMessage } from '../../core/appMessages.ts';
import { formatDateTime } from '../../core/utils.ts';
import { dismissRead, markAllRead, markRead } from './notificationActions';

export function NotificationIcon({ notification }: { notification: NotificationDto }) {
  if (notification.kind === 'MESSAGE') return <Icon name="mail" className="c-blue" />;
  return <StatusIcon status={notification.level ?? 'YELLOW'} />;
}

export function NotificationBell() {
  const user = useCurrentUser();
  const { navigate } = useRouter();
  const { language } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useClickOutside(open, () => setOpen(false));
  const m = (key: keyof typeof APP_MESSAGES.ru, values?: Record<string, string | number>) => appMessage(language, key, values);

  const unread = useQuery('notifications:unread', () => api.get<{ count: number }>('/me/notifications/unread-count'), {
    refreshMs: 60_000,
  });
  const latest = useQuery(open ? 'notifications:latest' : null, () =>
    api.get<Paginated<NotificationDto>>('/me/notifications', { pageSize: 8 }),
  );

  const allPath = user.systemRoles.includes('ADMIN') ? '/admin/notifications' : '/user/notifications';
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
        title={m('notifications')}
        aria-label={`${m('notifications')}, ${m('unreadCount')}: ${count}`}
        onClick={() => setOpen((current) => !current)}
      >
        <Icon name="bell" />
        {count > 0 && <span className="count-badge">{count > 99 ? '99+' : count}</span>}
      </button>
      {open && (
        <div className="popover">
          <div className="popover-head notif-head">
            <div className="row">
              <span className="bold">{m('notifications')}</span>
              {count > 0 && <span className="new-count">{count} {m('newCount')}</span>}
            </div>
            <div className="row">
              <button
                type="button"
                className="icon-btn tip"
                data-tip={m('markAllRead')}
                aria-label={m('markAllRead')}
                disabled={count === 0}
                onClick={() => markAllRead().catch(() => {})}
              >
                <Icon name="doneAll" />
              </button>
              <button
                type="button"
                className="icon-btn tip"
                data-tip={m('clearRead')}
                aria-label={m('clearRead')}
                onClick={() => dismissRead().catch(() => {})}
              >
                <Icon name="clearAll" />
              </button>
            </div>
          </div>
          <div className="popover-body">
            {latest.data?.items.length === 0 && <div className="empty">{m('noNotifications')}</div>}
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
              {m('allNotifications')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
