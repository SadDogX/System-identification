import { useState } from 'react';
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box,
  Button,
  Chip,
  InputAdornment,
  Link,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Tooltip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { USER_LIST_FILTERS, type CredentialStatus, type Paginated, type UserListItemDto } from '@app/shared';
import { api } from '../../api/client';
import { PageHeader } from '../../components/PageHeader';
import { StatusDot } from '../../components/StatusBadge';
import { STATUS_COLORS } from '../../theme';
import { ROLE_LABELS } from '../../utils';
import { UserFormDialog } from './UserFormDialog';

type Filter = (typeof USER_LIST_FILTERS)[number];

const FILTER_LABELS: Record<Filter, string> = {
  all: 'Все',
  USER: 'Сотрудники',
  ADMIN: 'Администраторы',
  hasRed: 'Есть красные',
  hasYellow: 'Есть жёлтые',
  hasWhite: 'Есть незаполненные',
};

function CountChip({ status, count }: { status: CredentialStatus; count: number }) {
  if (!count) return null;
  const c = STATUS_COLORS[status];
  return (
    <Chip
      size="small"
      icon={<StatusDot status={status} />}
      label={count}
      variant="outlined"
      sx={{ pl: 0.5, bgcolor: c.bg, borderColor: c.border, color: c.main, fontWeight: 600 }}
    />
  );
}

export function UsersPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const filter = (USER_LIST_FILTERS as readonly string[]).includes(params.get('filter') ?? '') ? (params.get('filter') as Filter) : 'all';
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [createOpen, setCreateOpen] = useState(false);

  const { data } = useQuery({
    queryKey: ['admin', 'users', { q, filter, page, pageSize }],
    queryFn: () =>
      api
        .get<Paginated<UserListItemDto>>('/admin/users', { params: { q: q || undefined, filter, page: page + 1, pageSize } })
        .then((r) => r.data),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <PageHeader
        title="Пользователи"
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
            Создать пользователя
          </Button>
        }
      />
      <Paper>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ p: 2 }}>
          <TextField
            placeholder="Поиск по ФИО или логину"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(0);
            }}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
          />
          <TextField
            select
            label="Фильтр"
            value={filter}
            onChange={(e) => {
              setParams(e.target.value === 'all' ? {} : { filter: e.target.value });
              setPage(0);
            }}
            sx={{ minWidth: { sm: 240 } }}
          >
            {USER_LIST_FILTERS.map((f) => (
              <MenuItem key={f} value={f}>
                {FILTER_LABELS[f]}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>ФИО</TableCell>
                <TableCell>Логин</TableCell>
                <TableCell>Роль</TableCell>
                <TableCell>Статус</TableCell>
                <TableCell>Удостоверения</TableCell>
                <TableCell>Создан</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data?.items.map((u) => (
                <TableRow key={u.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/admin/users/${u.id}`)}>
                  <TableCell>
                    <Link component={RouterLink} to={`/admin/users/${u.id}`} underline="hover" onClick={(e) => e.stopPropagation()}>
                      {u.fullName}
                    </Link>
                    {u.position && <Box sx={{ color: 'text.secondary', fontSize: 12 }}>{u.position}</Box>}
                  </TableCell>
                  <TableCell>{u.login}</TableCell>
                  <TableCell>{ROLE_LABELS[u.role]}</TableCell>
                  <TableCell>
                    <Chip size="small" label={u.isActive ? 'Активен' : 'Заблокирован'} color={u.isActive ? 'default' : 'error'} variant="outlined" />
                  </TableCell>
                  <TableCell>
                    {u.role === 'USER' ? (
                      <Tooltip title={`Всего: ${u.counts.total}`}>
                        <Stack direction="row" spacing={0.5}>
                          <CountChip status="RED" count={u.counts.RED} />
                          <CountChip status="YELLOW" count={u.counts.YELLOW} />
                          <CountChip status="GREEN" count={u.counts.GREEN} />
                          <CountChip status="WHITE" count={u.counts.WHITE} />
                        </Stack>
                      </Tooltip>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell>{new Date(u.createdAt).toLocaleDateString('ru-RU')}</TableCell>
                </TableRow>
              ))}
              {data?.items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    Никого не найдено
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={data?.total ?? 0}
          page={page}
          rowsPerPage={pageSize}
          onPageChange={(_, p) => setPage(p)}
          onRowsPerPageChange={(e) => {
            setPageSize(Number(e.target.value));
            setPage(0);
          }}
          rowsPerPageOptions={[20, 50, 100]}
        />
      </Paper>
      <UserFormDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  );
}
