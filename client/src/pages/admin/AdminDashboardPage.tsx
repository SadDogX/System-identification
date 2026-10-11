import { Link as RouterLink, useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Link,
  List,
  ListItem,
  ListItemText,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import PeopleIcon from '@mui/icons-material/People';
import { useQuery } from '@tanstack/react-query';
import { AUDIT_ACTION_LABELS, CREDENTIAL_STATUSES, STATUS_LABELS, formatDateRu, type DashboardDto } from '@app/shared';
import { api } from '../../api/client';
import { PageHeader } from '../../components/PageHeader';
import { StatusBadge, StatusIcon } from '../../components/StatusBadge';
import { STATUS_COLORS } from '../../theme';
import { formatDateTime } from '../../utils';

function Section({ title, link, children }: { title: string; link?: { to: string; label: string }; children: React.ReactNode }) {
  return (
    <Paper sx={{ p: 2, minWidth: 0 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
        <Typography fontWeight={600}>{title}</Typography>
        {link && (
          <Button size="small" component={RouterLink} to={link.to}>
            {link.label}
          </Button>
        )}
      </Stack>
      {children}
    </Paper>
  );
}

/** Главный вопрос: «У кого какие удостоверения заканчиваются и когда?» */
export function AdminDashboardPage() {
  const navigate = useNavigate();
  const { data } = useQuery({
    queryKey: ['admin', 'dashboard'],
    queryFn: () => api.get<DashboardDto>('/admin/dashboard').then((r) => r.data),
  });

  return (
    <>
      <PageHeader title="Дашборд" subtitle="Кто требует внимания и какие сроки подходят к концу" />

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', mb: 3 }}>
        <Paper sx={{ p: 2, cursor: 'pointer' }} onClick={() => navigate('/admin/users')}>
          <Stack direction="row" spacing={1} alignItems="center">
            <PeopleIcon fontSize="small" color="primary" />
            <Typography variant="body2" color="text.secondary">
              Сотрудников
            </Typography>
          </Stack>
          <Typography variant="h4" fontWeight={600} sx={{ mt: 1 }}>
            {data?.totalUsers ?? '—'}
          </Typography>
        </Paper>
        {CREDENTIAL_STATUSES.map((s) => (
          <Paper
            key={s}
            sx={{ p: 2, cursor: 'pointer', borderLeft: `4px solid ${STATUS_COLORS[s].border}`, '&:hover': { bgcolor: STATUS_COLORS[s].bg } }}
            onClick={() => navigate(`/admin/credentials?status=${s}`)}
          >
            <Stack direction="row" spacing={1} alignItems="center">
              <StatusIcon status={s} />
              <Typography variant="body2" color="text.secondary">
                {STATUS_LABELS[s]}
              </Typography>
            </Stack>
            <Typography variant="h4" fontWeight={600} sx={{ mt: 1, color: s === 'WHITE' ? 'text.primary' : STATUS_COLORS[s].main }}>
              {data?.counts[s] ?? '—'}
            </Typography>
          </Paper>
        ))}
      </Box>

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 2fr) minmax(0, 1fr)' } }}>
        <Section title="Ближайшие истечения" link={{ to: '/admin/credentials?status=RED', label: 'Все критичные' }}>
          {data?.upcoming.length === 0 ? (
            <Typography color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
              В ближайшее время сроки не истекают
            </Typography>
          ) : (
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Сотрудник</TableCell>
                    <TableCell>Удостоверение</TableCell>
                    <TableCell>До</TableCell>
                    <TableCell>Статус</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data?.upcoming.map((c) => (
                    <TableRow key={c.id} hover>
                      <TableCell>
                        <Link component={RouterLink} to={`/admin/users/${c.userId}`} underline="hover">
                          {c.user?.fullName}
                        </Link>
                      </TableCell>
                      <TableCell>{c.name}</TableCell>
                      <TableCell>{formatDateRu(c.expiryDate)}</TableCell>
                      <TableCell>
                        <StatusBadge status={c.status} daysLeft={c.daysLeft} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          )}
        </Section>

        <Stack spacing={2}>
          <Section title="Сотрудники с критичными сроками" link={{ to: '/admin/users?filter=hasRed', label: 'Все' }}>
            {data?.criticalUsers.length === 0 && (
              <Typography color="text.secondary" variant="body2">
                Таких нет
              </Typography>
            )}
            <List dense disablePadding>
              {data?.criticalUsers.map((u) => (
                <ListItem key={u.id} disableGutters>
                  <Box sx={{ mr: 1.5, display: 'flex' }}>
                    <StatusIcon status="RED" />
                  </Box>
                  <ListItemText
                    primary={
                      <Link component={RouterLink} to={`/admin/users/${u.id}`} underline="hover">
                        {u.fullName}
                      </Link>
                    }
                    secondary={`Критичных: ${u.redCount} · ближайшее до ${formatDateRu(u.nearestExpiry)}`}
                  />
                </ListItem>
              ))}
            </List>
          </Section>

          <Section title="Последние изменения" link={{ to: '/admin/audit-log', label: 'Журнал' }}>
            <List dense disablePadding>
              {data?.recentChanges.map((a) => (
                <ListItem key={a.id} disableGutters>
                  <ListItemText
                    primary={`${a.actor?.fullName ?? 'Система'}: ${(AUDIT_ACTION_LABELS[a.action] ?? a.action).toLowerCase()}${a.targetUser && a.targetUser.id !== a.actor?.id ? ` — ${a.targetUser.fullName}` : ''}`}
                    secondary={formatDateTime(a.createdAt)}
                  />
                </ListItem>
              ))}
            </List>
          </Section>
        </Stack>
      </Box>
    </>
  );
}
