import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  FormControlLabel,
  InputAdornment,
  MenuItem,
  Paper,
  Stack,
  Switch,
  TablePagination,
  TextField,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  CREDENTIAL_STATUSES,
  type CatalogItemDto,
  type CredentialStatus,
  type DashboardDto,
  type Paginated,
  type UserCredentialDto,
} from '@app/shared';
import { api } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { useAdminCredentialActions } from '../../components/AdminCredentialActions';
import { CredentialView, ViewToggle } from '../../components/CredentialViews';
import { PageHeader } from '../../components/PageHeader';
import { QuickFilters, type StatusFilter } from '../../components/QuickFilters';
import { useViewMode } from '../../hooks/useViewMode';

export function AdminCredentialsPage() {
  const { settings } = useAuth();
  const [params, setParams] = useSearchParams();
  const [mode, setMode, isMobile] = useViewMode();
  const { renderActions, dialogs } = useAdminCredentialActions();
  const [q, setQ] = useState('');
  const [credentialId, setCredentialId] = useState<number | ''>('');
  const [marked, setMarked] = useState(false);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);

  // Статус живёт в URL — на отфильтрованный список можно дать ссылку (дашборд, сводка)
  const rawStatus = params.get('status');
  const status: StatusFilter = CREDENTIAL_STATUSES.includes(rawStatus as CredentialStatus) ? (rawStatus as CredentialStatus) : 'ALL';

  const catalog = useQuery({
    queryKey: ['admin', 'catalog', false],
    queryFn: () => api.get<CatalogItemDto[]>('/admin/catalog').then((r) => r.data),
  });
  const dashboard = useQuery({
    queryKey: ['admin', 'dashboard'],
    queryFn: () => api.get<DashboardDto>('/admin/dashboard').then((r) => r.data),
  });
  const { data } = useQuery({
    queryKey: ['admin', 'credentials', { q, status, credentialId, marked, page, pageSize }],
    queryFn: () =>
      api
        .get<Paginated<UserCredentialDto>>('/admin/credentials', {
          params: {
            q: q || undefined,
            status: status === 'ALL' ? undefined : status,
            credentialId: credentialId || undefined,
            marked: marked || undefined,
            page: page + 1,
            pageSize,
          },
        })
        .then((r) => r.data),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <PageHeader
        title="Удостоверения"
        subtitle="Сначала ближайшие истечения"
        actions={<ViewToggle value={mode} onChange={setMode} hidden={isMobile} />}
      />
      <Stack spacing={2} sx={{ mb: 2 }}>
        <QuickFilters
          value={status}
          thresholds={settings}
          counts={marked ? undefined : dashboard.data?.counts}
          onChange={(v) => {
            setParams(v === 'ALL' ? {} : { status: v });
            setPage(0);
          }}
        />
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
          <TextField
            placeholder="Поиск: ФИО, логин, номер, удостоверение"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(0);
            }}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
            sx={{ bgcolor: 'background.paper' }}
          />
          <TextField
            select
            label="Удостоверение"
            value={credentialId}
            onChange={(e) => {
              setCredentialId(e.target.value === '' ? '' : Number(e.target.value));
              setPage(0);
            }}
            sx={{ minWidth: { md: 280 }, bgcolor: 'background.paper' }}
          >
            <MenuItem value="">Все</MenuItem>
            {catalog.data?.map((c) => (
              <MenuItem key={c.id} value={c.id}>
                {c.name}
              </MenuItem>
            ))}
          </TextField>
          <FormControlLabel
            sx={{ whiteSpace: 'nowrap' }}
            control={<Switch checked={marked} onChange={(e) => { setMarked(e.target.checked); setPage(0); }} />}
            label="Помеченные на удаление"
          />
        </Stack>
      </Stack>

      <Paper sx={mode === 'cards' ? { bgcolor: 'transparent', border: 'none' } : undefined}>
        <CredentialView mode={mode} items={data?.items ?? []} showUser actions={renderActions} emptyText="Ничего не найдено" />
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
          rowsPerPageOptions={[50, 100, 200]}
        />
      </Paper>
      {dialogs}
    </>
  );
}
