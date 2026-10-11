import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Chip,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Pagination,
  Paper,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import type { NotificationDto, Paginated } from '@app/shared';
import { api } from '../api/client';
import { NotificationIcon, useNotificationMutations } from '../components/NotificationBell';
import { PageHeader } from '../components/PageHeader';
import { formatDateTime } from '../utils';

type Kind = 'ALL' | 'EXPIRY' | 'MESSAGE';
const PAGE_SIZE = 20;

export function NotificationsPage() {
  const navigate = useNavigate();
  const [kind, setKind] = useState<Kind>('ALL');
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<number | null>(null);
  const { markRead, markAll } = useNotificationMutations();

  const { data } = useQuery({
    queryKey: ['notifications', 'list', kind, page],
    queryFn: () =>
      api
        .get<Paginated<NotificationDto>>('/me/notifications', {
          params: { page, pageSize: PAGE_SIZE, ...(kind !== 'ALL' && { kind }) },
        })
        .then((r) => r.data),
  });

  const open = (n: NotificationDto) => {
    if (!n.readAt) markRead.mutate(n.id);
    // Сообщение раскрываем на месте, остальные ведут на нужную страницу
    if (n.kind === 'MESSAGE' || !n.link) setExpanded(expanded === n.id ? null : n.id);
    else navigate(n.link);
  };

  return (
    <>
      <PageHeader
        title="Уведомления"
        actions={
          <Button variant="outlined" onClick={() => markAll.mutate()}>
            Отметить все как прочитанные
          </Button>
        }
      />
      <Paper>
        <Tabs
          value={kind}
          onChange={(_, v) => {
            setKind(v);
            setPage(1);
          }}
          sx={{ borderBottom: 1, borderColor: 'divider', px: 1 }}
          variant="scrollable"
        >
          <Tab value="ALL" label="Все" />
          <Tab value="EXPIRY" label="Сроки" />
          <Tab value="MESSAGE" label="Сообщения" />
        </Tabs>
        <List disablePadding>
          {data?.items.length === 0 && (
            <Typography color="text.secondary" sx={{ p: 4, textAlign: 'center' }}>
              Уведомлений нет
            </Typography>
          )}
          {data?.items.map((n) => (
            <ListItemButton
              key={n.id}
              onClick={() => open(n)}
              divider
              sx={{ alignItems: 'flex-start', bgcolor: n.readAt ? undefined : 'action.hover' }}
            >
              <ListItemIcon sx={{ minWidth: 36, mt: 0.5 }}>
                <NotificationIcon n={n} />
              </ListItemIcon>
              <ListItemText
                primary={
                  <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
                    <Typography fontWeight={n.readAt ? 400 : 600}>{n.title}</Typography>
                    {!n.readAt && <Chip size="small" label="Новое" color="primary" />}
                  </Stack>
                }
                secondary={
                  <>
                    {(expanded === n.id || n.kind !== 'MESSAGE') && (
                      <Typography component="span" variant="body2" display="block" sx={{ whiteSpace: 'pre-wrap', my: 0.5 }} color="text.primary">
                        {n.body}
                      </Typography>
                    )}
                    {formatDateTime(n.createdAt)}
                  </>
                }
              />
            </ListItemButton>
          ))}
        </List>
        {data && data.total > PAGE_SIZE && (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
            <Pagination count={Math.ceil(data.total / PAGE_SIZE)} page={page} onChange={(_, p) => setPage(p)} />
          </Box>
        )}
      </Paper>
    </>
  );
}
