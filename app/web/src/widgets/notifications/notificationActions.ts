import type { NotificationDto } from '@app/shared';
import { api } from '../../core/api.ts';
import { invalidate } from '../../core/data.ts';

export async function markRead(notification: NotificationDto) {
  if (notification.readAt) return;
  await api.patch(`/me/notifications/${notification.id}/read`);
  invalidate('notifications');
}

export async function markAllRead() {
  await api.post('/me/notifications/read-all');
  invalidate('notifications');
}

export async function dismissRead() {
  await api.post('/me/notifications/dismiss-read');
  invalidate('notifications');
}
