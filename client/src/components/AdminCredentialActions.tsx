import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import BackspaceOutlinedIcon from '@mui/icons-material/BackspaceOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import RestoreIcon from '@mui/icons-material/Restore';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { addMonths, formatDateRu, isIsoDate, todayInTimezone, type UserCredentialDto } from '@app/shared';
import { api, errorMessage } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { formatValidity } from '../utils';
import { ConfirmDialog } from './ConfirmDialog';

type Pending = { kind: 'edit' | 'clear' | 'mark' | 'unmark'; item: UserCredentialDto } | null;

function EditDialog({ item, onClose }: { item: UserCredentialDto | null; onClose: () => void }) {
  const { settings } = useAuth();
  const queryClient = useQueryClient();
  const today = todayInTimezone(settings.timezone);
  const [number, setNumber] = useState('');
  const [comment, setComment] = useState('');
  const [issueDate, setIssueDate] = useState('');

  useEffect(() => {
    if (!item) return;
    setNumber(item.number ?? '');
    setComment(item.comment ?? '');
    setIssueDate(item.issueDate ?? '');
  }, [item]);

  const mutation = useMutation({
    mutationFn: () =>
      api.patch(`/admin/credentials/${item!.id}`, {
        number,
        comment,
        ...(issueDate && issueDate !== item!.issueDate && { issueDate }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin'] });
      onClose();
    },
  });

  const dateInvalid = !!issueDate && (!isIsoDate(issueDate) || issueDate > today);
  const expiry = item && issueDate && !dateInvalid ? addMonths(issueDate, item.validityMonths) : null;

  return (
    <Dialog open={!!item} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{item?.name}</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          {item?.user && <Typography color="text.secondary">{item.user.fullName}</Typography>}
          <TextField label="Номер удостоверения" value={number} onChange={(e) => setNumber(e.target.value)} />
          <TextField
            type="date"
            label="Дата выдачи"
            value={issueDate}
            onChange={(e) => setIssueDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            inputProps={{ max: today }}
            error={dateInvalid}
            helperText={dateInvalid ? 'Дата выдачи не может быть в будущем' : item && `Срок действия: ${formatValidity(item.validityMonths)}`}
          />
          <Typography variant="body2">
            Действительно до: <b>{formatDateRu(expiry)}</b>
          </Typography>
          <TextField label="Комментарий" value={comment} onChange={(e) => setComment(e.target.value)} multiline minRows={2} />
          {mutation.isError && <Alert severity="error">{errorMessage(mutation.error)}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Отмена</Button>
        <Button variant="contained" disabled={dateInvalid || mutation.isPending} onClick={() => mutation.mutate()}>
          Сохранить
        </Button>
      </DialogActions>
    </Dialog>
  );
}

const CONFIRM = {
  clear: {
    title: 'Очистить данные удостоверения?',
    text: 'Номер, даты и комментарий будут стёрты. Само удостоверение останется у сотрудника со статусом «Не заполнено».',
    button: 'Очистить',
    url: 'clear',
  },
  mark: {
    title: 'Пометить на удаление?',
    text: 'Запись пропадёт из списков и статистики, но останется в базе. Пометку можно снять в любой момент.',
    button: 'Пометить',
    url: 'mark-deletion',
  },
  unmark: {
    title: 'Снять пометку на удаление?',
    text: 'Запись снова появится в списках и статистике.',
    button: 'Восстановить',
    url: 'unmark-deletion',
  },
} as const;

/** Действия администратора над удостоверением: редактирование, очистка, пометка на удаление. */
export function useAdminCredentialActions() {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<Pending>(null);
  const [error, setError] = useState<string | null>(null);

  const action = useMutation({
    mutationFn: ({ kind, item }: { kind: 'clear' | 'mark' | 'unmark'; item: UserCredentialDto }) =>
      api.post(`/admin/credentials/${item.id}/${CONFIRM[kind].url}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin'] });
      setPending(null);
    },
    onError: (e) => setError(errorMessage(e)),
  });

  const renderActions = (item: UserCredentialDto) =>
    item.isMarkedForDeletion ? (
      <Tooltip title="Снять пометку на удаление">
        <IconButton size="small" onClick={() => setPending({ kind: 'unmark', item })}>
          <RestoreIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    ) : (
      <>
        <Tooltip title="Редактировать">
          <IconButton size="small" onClick={() => setPending({ kind: 'edit', item })}>
            <EditIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Очистить данные">
          <span>
            <IconButton size="small" disabled={!item.issueDate && !item.number} onClick={() => setPending({ kind: 'clear', item })}>
              <BackspaceOutlinedIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Пометить на удаление">
          <IconButton size="small" onClick={() => setPending({ kind: 'mark', item })}>
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </>
    );

  const confirmKind = pending && pending.kind !== 'edit' ? pending.kind : null;
  const dialogs = (
    <>
      <EditDialog item={pending?.kind === 'edit' ? pending.item : null} onClose={() => setPending(null)} />
      {confirmKind && (
        <ConfirmDialog
          open
          title={CONFIRM[confirmKind].title}
          text={error ?? `${pending!.item.name}${pending!.item.user ? ` — ${pending!.item.user.fullName}` : ''}. ${CONFIRM[confirmKind].text}`}
          confirmText={CONFIRM[confirmKind].button}
          danger={confirmKind !== 'unmark'}
          loading={action.isPending}
          onConfirm={() => action.mutate({ kind: confirmKind, item: pending!.item })}
          onClose={() => {
            setPending(null);
            setError(null);
          }}
        />
      )}
    </>
  );

  return { renderActions, dialogs };
}
