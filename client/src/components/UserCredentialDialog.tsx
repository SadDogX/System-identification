import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { addMonths, formatDateRu, getCredentialStatus, isIsoDate, todayInTimezone, type UserCredentialDto } from '@app/shared';
import { api, errorMessage } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { formatValidity } from '../utils';
import { StatusBadge } from './StatusBadge';

interface Props {
  open: boolean;
  credentials: UserCredentialDto[];
  initialId: number | null;
  onClose: () => void;
}

/**
 * Сотрудник выбирает удостоверение из списка, срок подтягивается из справочника,
 * дату выдачи выбирает в календаре (можно задним числом). Дата окончания считается сама.
 */
export function UserCredentialDialog({ open, credentials, initialId, onClose }: Props) {
  const { settings } = useAuth();
  const queryClient = useQueryClient();
  const today = todayInTimezone(settings.timezone);
  const [selectedId, setSelectedId] = useState<number | ''>('');
  const [issueDate, setIssueDate] = useState('');

  useEffect(() => {
    if (!open) return;
    const initial = credentials.find((c) => c.id === initialId) ?? credentials[0];
    setSelectedId(initial?.id ?? '');
    setIssueDate(initial?.issueDate ?? '');
  }, [open, initialId, credentials]);

  const selected = credentials.find((c) => c.id === selectedId);
  const validDate = isIsoDate(issueDate) && issueDate <= today;
  const expiryPreview = selected && validDate ? addMonths(issueDate, selected.validityMonths) : null;
  const preview = expiryPreview ? getCredentialStatus(expiryPreview, today, settings) : null;

  const mutation = useMutation({
    mutationFn: () => api.patch(`/me/credentials/${selectedId}`, { issueDate }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me'] });
      onClose();
    },
  });

  const dateError = issueDate && !validDate ? 'Дата выдачи не может быть в будущем' : undefined;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Данные удостоверения</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          <TextField
            select
            label="Удостоверение"
            value={selectedId}
            onChange={(e) => {
              const id = Number(e.target.value);
              setSelectedId(id);
              setIssueDate(credentials.find((c) => c.id === id)?.issueDate ?? '');
              mutation.reset();
            }}
          >
            {credentials.map((c) => (
              <MenuItem key={c.id} value={c.id}>
                {c.name}
              </MenuItem>
            ))}
          </TextField>

          {selected && (
            <Typography variant="body2" color="text.secondary">
              Срок действия по справочнику: <b>{formatValidity(selected.validityMonths)}</b>
            </Typography>
          )}

          <TextField
            type="date"
            label="Дата выдачи"
            value={issueDate}
            onChange={(e) => setIssueDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            inputProps={{ max: today }}
            error={!!dateError}
            helperText={dateError ?? 'Можно указать дату задним числом'}
          />

          <Box sx={{ p: 1.5, bgcolor: 'grey.50', borderRadius: 1, border: '1px solid', borderColor: 'grey.200' }}>
            <Typography variant="body2" color="text.secondary">
              Действительно до (рассчитывается автоматически)
            </Typography>
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mt: 0.5 }}>
              <Typography fontWeight={600}>{formatDateRu(expiryPreview)}</Typography>
              {preview && <StatusBadge status={preview.status} daysLeft={preview.daysLeft} />}
            </Stack>
          </Box>

          {mutation.isError && <Alert severity="error">{errorMessage(mutation.error)}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Отмена</Button>
        <Button variant="contained" disabled={!selected || !validDate || mutation.isPending} onClick={() => mutation.mutate()}>
          Сохранить
        </Button>
      </DialogActions>
    </Dialog>
  );
}
