import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box,
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
  Typography,
} from '@mui/material';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { AUDIT_ACTION_LABELS, AUDIT_FIELD_LABELS, formatDateRu, isIsoDate, type AuditLogDto, type Paginated } from '@app/shared';
import { api } from '../../api/client';
import { PageHeader } from '../../components/PageHeader';
import { formatDateTime, ROLE_LABELS } from '../../utils';

const ENTITY_TYPES = [
  { value: '', label: 'Все объекты' },
  { value: 'UserCredential', label: 'Удостоверения' },
  { value: 'User', label: 'Пользователи' },
  { value: 'Credential', label: 'Справочник' },
  { value: 'Message', label: 'Сообщения' },
];

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'да' : 'нет';
  if (typeof value === 'string' && isIsoDate(value)) return formatDateRu(value);
  if (value === 'ADMIN' || value === 'USER') return ROLE_LABELS[value];
  return String(value);
}

function DiffView({ diff }: { diff: AuditLogDto['diff'] }) {
  if (!diff || Object.keys(diff).length === 0) return <>—</>;
  return (
    <Stack spacing={0.25}>
      {Object.entries(diff).map(([field, { from, to }]) => (
        <Typography key={field} variant="body2">
          <b>{AUDIT_FIELD_LABELS[field] ?? field}:</b>{' '}
          {from !== null && from !== undefined && (
            <>
              <Box component="span" sx={{ color: 'text.secondary', textDecoration: 'line-through' }}>
                {formatValue(from)}
              </Box>{' '}
              →{' '}
            </>
          )}
          {formatValue(to)}
        </Typography>
      ))}
    </Stack>
  );
}

export function AuditLogPage() {
  const [entityType, setEntityType] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(30);

  const { data } = useQuery({
    queryKey: ['admin', 'audit', { entityType, page, pageSize }],
    queryFn: () =>
      api
        .get<Paginated<AuditLogDto>>('/admin/audit-log', { params: { entityType: entityType || undefined, page: page + 1, pageSize } })
        .then((r) => r.data),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <PageHeader title="Журнал действий" subtitle="Кто, что и когда изменил" />
      <Paper>
        <Box sx={{ p: 2 }}>
          <TextField
            select
            label="Объект"
            value={entityType}
            onChange={(e) => {
              setEntityType(e.target.value);
              setPage(0);
            }}
            sx={{ maxWidth: 280 }}
          >
            {ENTITY_TYPES.map((t) => (
              <MenuItem key={t.value} value={t.value}>
                {t.label}
              </MenuItem>
            ))}
          </TextField>
        </Box>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Когда</TableCell>
                <TableCell>Кто</TableCell>
                <TableCell>Что</TableCell>
                <TableCell>Кого</TableCell>
                <TableCell>Изменение</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data?.items.map((a) => (
                <TableRow key={a.id} sx={{ verticalAlign: 'top' }}>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDateTime(a.createdAt)}</TableCell>
                  <TableCell>{a.actor?.fullName ?? 'Система'}</TableCell>
                  <TableCell>{AUDIT_ACTION_LABELS[a.action] ?? a.action}</TableCell>
                  <TableCell>
                    {a.targetUser ? (
                      <Link component={RouterLink} to={`/admin/users/${a.targetUser.id}`} underline="hover">
                        {a.targetUser.fullName}
                      </Link>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell>
                    <DiffView diff={a.diff} />
                  </TableCell>
                </TableRow>
              ))}
              {data?.items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    Записей нет
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
          rowsPerPageOptions={[30, 50, 100]}
        />
      </Paper>
    </>
  );
}
