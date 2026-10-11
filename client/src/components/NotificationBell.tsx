import { useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Divider,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Popover,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import MailIcon from '@mui/icons-material/Mail';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import type { NotificationDto, Paginated } from '@app/shared';
import { api } from '../api/client';
import { useCurrentUser } from '../auth/AuthContext';
import { formatDateTime } from '../utils';
import { StatusIcon } from './StatusBadge';

export function NotificationIcon({ n }: { n: NotificationDto }) {
  if (n.kind === 'MESSAGE') return <MailIcon fontSize="small" color="primary" />;
  return <StatusIcon status={n.level ?? 'YELLOW'} />;
}

export function useNotificationMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['notifications'] });
  const markRead = useMutation({ mutationFn: (id: number) => api.patch(`/me/notifications/${id}/read`), onSuccess: invalidate });
  const markAll = useMutation({ mutationFn: () => api.post('/me/notifications/read-all'), onSuccess: invalidate });
  return { markRead, markAll };
}

export function NotificationBell() {
  const user = useCurrentUser();
  const navigate = useNavigate();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const { markRead, markAll } = useNotificationMutations();

  // Счётчик непрочитанных обновляется раз в минуту
  const unread = useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: () => api.get<{ count: number }>('/me/notifications/unread-count').then((r) => r.data.count),
    refetchInterval: 60_000,
  });
  const latest = useQuery({
    queryKey: ['notifications', 'latest'],
    queryFn: () => api.get<Paginated<NotificationDto>>('/me/notifications?pageSize=8').then((r) => r.data.items),
    enabled: !!anchor,
  });

  const allPath = user.role === 'ADMIN' ? '/admin/notifications' : '/user/notifications';

  const open = (n: NotificationDto) => {
    if (!n.readAt) markRead.mutate(n.id);
    setAnchor(null);
    navigate(n.link ?? allPath);
  };

  return (
    <>
      <Tooltip title="Уведомления">
        <IconButton color="inherit" onClick={(e) => setAnchor(e.currentTarget)}>
          <Badge badgeContent={unread.data ?? 0} color="error" max={99}>
            <NotificationsIcon />
          </Badge>
        </IconButton>
      </Tooltip>
      <Popover
        open={!!anchor}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { width: 380, maxWidth: 'calc(100vw - 32px)' } } }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 2, py: 1.5 }}>
          <Typography fontWeight={600}>Уведомления</Typography>
          <Button size="small" disabled={!unread.data} onClick={() => markAll.mutate()}>
            Отметить все как прочитанные
          </Button>
        </Stack>
        <Divider />
        <List dense disablePadding sx={{ maxHeight: 420, overflow: 'auto' }}>
          {latest.data?.length === 0 && (
            <Typography color="text.secondary" sx={{ p: 3, textAlign: 'center' }}>
              Уведомлений нет
            </Typography>
          )}
          {latest.data?.map((n) => (
            <ListItemButton key={n.id} onClick={() => open(n)} sx={{ alignItems: 'flex-start', bgcolor: n.readAt ? undefined : 'action.hover' }}>
              <ListItemIcon sx={{ minWidth: 32, mt: 0.5 }}>
                <NotificationIcon n={n} />
              </ListItemIcon>
              <ListItemText
                primary={n.title}
                secondary={formatDateTime(n.createdAt)}
                primaryTypographyProps={{ fontWeight: n.readAt ? 400 : 600, fontSize: 14 }}
              />
            </ListItemButton>
          ))}
        </List>
        <Divider />
        <Box sx={{ p: 1, textAlign: 'center' }}>
          <Button
            size="small"
            onClick={() => {
              setAnchor(null);
              navigate(allPath);
            }}
          >
            Все уведомления
          </Button>
        </Box>
      </Popover>
    </>
  );
}
