import type { ReactNode } from 'react';
import {
  Box,
  Card,
  CardActions,
  CardContent,
  Link,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import TableRowsIcon from '@mui/icons-material/TableRows';
import GridViewIcon from '@mui/icons-material/GridView';
import { Link as RouterLink } from 'react-router-dom';
import { formatDateRu, type UserCredentialDto, type ViewMode } from '@app/shared';
import { STATUS_COLORS } from '../theme';
import { StatusBadge } from './StatusBadge';

export function ViewToggle({ value, onChange, hidden }: { value: ViewMode; onChange: (v: ViewMode) => void; hidden?: boolean }) {
  if (hidden) return null;
  return (
    <ToggleButtonGroup size="small" exclusive value={value} onChange={(_, v) => v && onChange(v)}>
      <ToggleButton value="table" aria-label="Таблица">
        <TableRowsIcon fontSize="small" sx={{ mr: 0.5 }} /> Таблица
      </ToggleButton>
      <ToggleButton value="cards" aria-label="Карточки">
        <GridViewIcon fontSize="small" sx={{ mr: 0.5 }} /> Карточки
      </ToggleButton>
    </ToggleButtonGroup>
  );
}

interface ViewProps {
  items: UserCredentialDto[];
  /** Показывать столбец «Сотрудник» (общий список у администратора). */
  showUser?: boolean;
  actions?: (item: UserCredentialDto) => ReactNode;
  emptyText?: string;
}

function UserLink({ item }: { item: UserCredentialDto }) {
  if (!item.user) return null;
  return (
    <Link component={RouterLink} to={`/admin/users/${item.user.id}`} underline="hover">
      {item.user.fullName}
    </Link>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <Box sx={{ py: 6, textAlign: 'center', color: 'text.secondary' }}>
      <Typography>{text}</Typography>
    </Box>
  );
}

export function CredentialTable({ items, showUser, actions, emptyText = 'Нет записей' }: ViewProps) {
  if (items.length === 0) return <Empty text={emptyText} />;
  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            {showUser && <TableCell>Сотрудник</TableCell>}
            <TableCell>Удостоверение</TableCell>
            <TableCell>Номер</TableCell>
            <TableCell>Дата выдачи</TableCell>
            <TableCell>Действительно до</TableCell>
            <TableCell>Статус</TableCell>
            {actions && <TableCell align="right" />}
          </TableRow>
        </TableHead>
        <TableBody>
          {items.map((item) => (
            <TableRow
              key={item.id}
              hover
              sx={{
                opacity: item.isMarkedForDeletion ? 0.55 : 1,
                // Цветная полоса слева — статус виден при беглом просмотре
                '& td:first-of-type': { borderLeft: `4px solid ${STATUS_COLORS[item.status].border}` },
              }}
            >
              {showUser && (
                <TableCell>
                  <UserLink item={item} />
                </TableCell>
              )}
              <TableCell>
                {item.name}
                {item.isMarkedForDeletion && (
                  <Typography variant="caption" color="error" display="block">
                    Помечено на удаление
                  </Typography>
                )}
              </TableCell>
              <TableCell>{item.number ?? '—'}</TableCell>
              <TableCell>{formatDateRu(item.issueDate)}</TableCell>
              <TableCell>{formatDateRu(item.expiryDate)}</TableCell>
              <TableCell>
                <StatusBadge status={item.status} daysLeft={item.daysLeft} />
              </TableCell>
              {actions && (
                <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                  {actions(item)}
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Stack direction="row" justifyContent="space-between" spacing={1}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={500} textAlign="right">
        {value}
      </Typography>
    </Stack>
  );
}

export function CredentialCards({ items, showUser, actions, emptyText = 'Нет записей' }: ViewProps) {
  if (items.length === 0) return <Empty text={emptyText} />;
  return (
    <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
      {items.map((item) => {
        const c = STATUS_COLORS[item.status];
        return (
          <Card
            key={item.id}
            sx={{
              bgcolor: c.bg,
              borderColor: c.border,
              borderWidth: item.status === 'WHITE' ? '1px' : '1px 1px 1px 6px',
              borderStyle: item.status === 'WHITE' ? 'dashed' : 'solid',
              opacity: item.isMarkedForDeletion ? 0.6 : 1,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <CardContent sx={{ flexGrow: 1 }}>
              <Stack spacing={1}>
                <Typography fontWeight={600}>{item.name}</Typography>
                {showUser && <UserLink item={item} />}
                <Box>
                  <StatusBadge status={item.status} daysLeft={item.daysLeft} />
                </Box>
                <Field label="Номер" value={item.number ?? '—'} />
                <Field label="Дата выдачи" value={formatDateRu(item.issueDate)} />
                <Field label="Действительно до" value={formatDateRu(item.expiryDate)} />
                {item.isMarkedForDeletion && (
                  <Typography variant="caption" color="error">
                    Помечено на удаление
                  </Typography>
                )}
              </Stack>
            </CardContent>
            {actions && <CardActions sx={{ justifyContent: 'flex-end', pt: 0 }}>{actions(item)}</CardActions>}
          </Card>
        );
      })}
    </Box>
  );
}

export function CredentialView({ mode, ...props }: ViewProps & { mode: ViewMode }) {
  return mode === 'table' ? <CredentialTable {...props} /> : <CredentialCards {...props} />;
}
