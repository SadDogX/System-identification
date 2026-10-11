import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Paper,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import ArchiveIcon from '@mui/icons-material/Archive';
import UnarchiveIcon from '@mui/icons-material/Unarchive';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { catalogItemSchema, type CatalogItemDto } from '@app/shared';
import { api, errorMessage } from '../../api/client';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { PageHeader } from '../../components/PageHeader';
import { formatValidity } from '../../utils';

interface Form {
  name: string;
  validityMonths: number;
  sortOrder: number;
}

function ItemDialog({ open, item, onClose }: { open: boolean; item: CatalogItemDto | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset, formState } = useForm<Form>({ resolver: zodResolver(catalogItemSchema) as never });

  useEffect(() => {
    if (open) reset({ name: item?.name ?? '', validityMonths: item?.validityMonths ?? 12, sortOrder: item?.sortOrder ?? 0 });
  }, [open, item, reset]);

  const mutation = useMutation({
    mutationFn: (data: Form) => (item ? api.put(`/admin/catalog/${item.id}`, data) : api.post('/admin/catalog', data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin'] });
      onClose();
    },
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} noValidate>
        <DialogTitle>{item ? 'Изменить удостоверение' : 'Новое удостоверение'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField label="Название" required {...register('name')} error={!!formState.errors.name} helperText={formState.errors.name?.message} />
            <TextField
              label="Срок действия, месяцев"
              type="number"
              required
              inputProps={{ min: 1 }}
              {...register('validityMonths')}
              error={!!formState.errors.validityMonths}
              helperText={formState.errors.validityMonths?.message ?? 'Например, 12 — один год, 36 — три года'}
            />
            <TextField label="Порядок в списке" type="number" inputProps={{ min: 0 }} {...register('sortOrder')} />
            {item && (
              <Alert severity="info">
                Новый срок применится к датам, которые будут введены после изменения. Уже заполненные даты не пересчитываются.
              </Alert>
            )}
            {!item && <Alert severity="info">Удостоверение сразу появится у всех сотрудников со статусом «Не заполнено».</Alert>}
            {mutation.isError && <Alert severity="error">{errorMessage(mutation.error)}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Отмена</Button>
          <Button type="submit" variant="contained" disabled={mutation.isPending}>
            Сохранить
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

export function CatalogPage() {
  const queryClient = useQueryClient();
  const [showArchived, setShowArchived] = useState(false);
  const [dialog, setDialog] = useState<{ open: boolean; item: CatalogItemDto | null }>({ open: false, item: null });
  const [archiveTarget, setArchiveTarget] = useState<CatalogItemDto | null>(null);

  const { data = [] } = useQuery({
    queryKey: ['admin', 'catalog', showArchived],
    queryFn: () => api.get<CatalogItemDto[]>('/admin/catalog', { params: { archived: showArchived } }).then((r) => r.data),
  });

  const toggleArchive = useMutation({
    mutationFn: (item: CatalogItemDto) => api.post(`/admin/catalog/${item.id}/${item.isArchived ? 'unarchive' : 'archive'}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin'] });
      setArchiveTarget(null);
    },
  });

  return (
    <>
      <PageHeader
        title="Справочник удостоверений"
        subtitle="Перечень удостоверений и сроки их действия"
        actions={
          <>
            <FormControlLabel control={<Switch checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />} label="Показать архив" />
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialog({ open: true, item: null })}>
              Добавить
            </Button>
          </>
        }
      />
      <Paper>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Название</TableCell>
                <TableCell>Срок действия</TableCell>
                <TableCell>Порядок</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {data.map((item) => (
                <TableRow key={item.id} hover sx={{ opacity: item.isArchived ? 0.55 : 1 }}>
                  <TableCell>
                    {item.name} {item.isArchived && <Chip size="small" label="В архиве" sx={{ ml: 1 }} />}
                  </TableCell>
                  <TableCell>{formatValidity(item.validityMonths)}</TableCell>
                  <TableCell>{item.sortOrder}</TableCell>
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                    <Tooltip title="Изменить">
                      <IconButton size="small" onClick={() => setDialog({ open: true, item })}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={item.isArchived ? 'Вернуть из архива' : 'В архив'}>
                      <IconButton size="small" onClick={() => setArchiveTarget(item)}>
                        {item.isArchived ? <UnarchiveIcon fontSize="small" /> : <ArchiveIcon fontSize="small" />}
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
              {data.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    Справочник пуст. Добавьте первое удостоверение.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
      <ItemDialog open={dialog.open} item={dialog.item} onClose={() => setDialog({ open: false, item: null })} />
      <ConfirmDialog
        open={!!archiveTarget}
        title={archiveTarget?.isArchived ? 'Вернуть из архива?' : 'Переместить в архив?'}
        text={
          toggleArchive.isError
            ? errorMessage(toggleArchive.error)
            : archiveTarget?.isArchived
              ? `«${archiveTarget.name}» снова появится у всех сотрудников.`
              : `«${archiveTarget?.name}» пропадёт у всех сотрудников из списков и статистики. Введённые данные сохранятся.`
        }
        confirmText={archiveTarget?.isArchived ? 'Вернуть' : 'В архив'}
        danger={!archiveTarget?.isArchived}
        loading={toggleArchive.isPending}
        onConfirm={() => archiveTarget && toggleArchive.mutate(archiveTarget)}
        onClose={() => setArchiveTarget(null)}
      />
    </>
  );
}
