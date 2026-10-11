import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  FormControlLabel,
  List,
  ListItem,
  ListItemText,
  Pagination,
  Paper,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { sendMessageSchema, type MessageDto, type Paginated, type SendMessageRequest } from '@app/shared';
import { api, errorMessage } from '../../api/client';
import { PageHeader } from '../../components/PageHeader';
import { formatDateTime } from '../../utils';

interface UserOption {
  id: number;
  fullName: string;
  login: string;
}

const PAGE_SIZE = 10;

export function MessagesPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const { register, handleSubmit, control, watch, reset, formState } = useForm<SendMessageRequest>({
    resolver: zodResolver(sendMessageSchema),
    defaultValues: { recipient: 'user', subject: '', body: '' },
  });
  const recipient = watch('recipient');

  const options = useQuery({
    queryKey: ['admin', 'user-options'],
    queryFn: () => api.get<UserOption[]>('/admin/users/options').then((r) => r.data),
  });
  const history = useQuery({
    queryKey: ['admin', 'messages', page],
    queryFn: () => api.get<Paginated<MessageDto>>('/admin/messages', { params: { page, pageSize: PAGE_SIZE } }).then((r) => r.data),
  });

  const send = useMutation({
    mutationFn: (data: SendMessageRequest) => api.post<{ recipientsCount: number }>('/admin/messages', data).then((r) => r.data),
    onSuccess: () => {
      reset({ recipient, subject: '', body: '' });
      queryClient.invalidateQueries({ queryKey: ['admin', 'messages'] });
    },
  });

  return (
    <>
      <PageHeader title="Сообщения" subtitle="Сообщение появится в центре уведомлений получателя" />
      <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, alignItems: 'start' }}>
        <Paper sx={{ p: 3 }}>
          <form onSubmit={handleSubmit((d) => send.mutate(d))} noValidate>
            <Stack spacing={2}>
              <Typography fontWeight={600}>Новое сообщение</Typography>
              <Controller
                name="recipient"
                control={control}
                render={({ field }) => (
                  <RadioGroup row {...field}>
                    <FormControlLabel value="user" control={<Radio />} label="Конкретный пользователь" />
                    <FormControlLabel value="all" control={<Radio />} label="Все пользователи" />
                  </RadioGroup>
                )}
              />
              {recipient === 'user' && (
                <Controller
                  name="userId"
                  control={control}
                  render={({ field }) => (
                    <Autocomplete
                      options={options.data ?? []}
                      getOptionLabel={(o) => `${o.fullName} (${o.login})`}
                      value={options.data?.find((o) => o.id === field.value) ?? null}
                      onChange={(_, v) => field.onChange(v?.id)}
                      noOptionsText="Нет активных сотрудников"
                      renderInput={(params) => (
                        <TextField {...params} label="Получатель" error={!!formState.errors.userId} helperText={formState.errors.userId?.message} />
                      )}
                    />
                  )}
                />
              )}
              {recipient === 'all' && <Alert severity="info">Сообщение получат все активные сотрудники.</Alert>}
              <TextField label="Тема" {...register('subject')} error={!!formState.errors.subject} helperText={formState.errors.subject?.message} />
              <TextField
                label="Сообщение"
                multiline
                minRows={5}
                {...register('body')}
                error={!!formState.errors.body}
                helperText={formState.errors.body?.message}
              />
              {send.isSuccess && <Alert severity="success">Отправлено получателям: {send.data.recipientsCount}</Alert>}
              {send.isError && <Alert severity="error">{errorMessage(send.error)}</Alert>}
              <Box>
                <Button type="submit" variant="contained" startIcon={<SendIcon />} disabled={send.isPending}>
                  Отправить
                </Button>
              </Box>
            </Stack>
          </form>
        </Paper>

        <Paper sx={{ p: 2 }}>
          <Typography fontWeight={600} sx={{ mb: 1 }}>
            Отправленные
          </Typography>
          {history.data?.items.length === 0 && <Typography color="text.secondary">Сообщений пока нет</Typography>}
          <List disablePadding>
            {history.data?.items.map((m) => (
              <ListItem key={m.id} divider disableGutters sx={{ alignItems: 'flex-start' }}>
                <ListItemText
                  primary={
                    <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
                      <Typography fontWeight={600}>{m.subject}</Typography>
                      <Chip size="small" label={m.isBroadcast ? 'Всем' : m.recipient?.fullName ?? 'Лично'} variant="outlined" />
                    </Stack>
                  }
                  secondary={
                    <>
                      <Typography component="span" variant="body2" display="block" color="text.primary" sx={{ whiteSpace: 'pre-wrap', my: 0.5 }}>
                        {m.body}
                      </Typography>
                      {formatDateTime(m.createdAt)} · {m.sender.fullName} · прочитали {m.readCount} из {m.recipientsCount}
                    </>
                  }
                />
              </ListItem>
            ))}
          </List>
          {history.data && history.data.total > PAGE_SIZE && (
            <Box sx={{ display: 'flex', justifyContent: 'center', pt: 2 }}>
              <Pagination count={Math.ceil(history.data.total / PAGE_SIZE)} page={page} onChange={(_, p) => setPage(p)} />
            </Box>
          )}
        </Paper>
      </Box>
    </>
  );
}
