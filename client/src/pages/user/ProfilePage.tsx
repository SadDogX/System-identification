import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Box, Button, Paper, Stack, TextField, Typography } from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import { updateProfileSchema, type UserDto } from '@app/shared';
import { api, errorMessage } from '../../api/client';
import { useAuth, useCurrentUser } from '../../auth/AuthContext';
import { PageHeader } from '../../components/PageHeader';
import { ROLE_LABELS } from '../../utils';

interface Form {
  phone: string;
  email: string;
}

function ReadOnly({ label, value }: { label: string; value: string | null }) {
  return (
    <Box>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography>{value || '—'}</Typography>
    </Box>
  );
}

export function ProfilePage() {
  const user = useCurrentUser();
  const { setUser } = useAuth();
  const { register, handleSubmit, formState } = useForm<Form>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: { phone: user.phone ?? '', email: user.email ?? '' },
  });
  const mutation = useMutation({
    mutationFn: (data: Form) => api.patch<UserDto>('/me', data).then((r) => r.data),
    onSuccess: setUser,
  });

  return (
    <>
      <PageHeader title="Профиль" />
      <Paper sx={{ p: 3, maxWidth: 560 }}>
        <Stack spacing={2}>
          <ReadOnly label="ФИО" value={user.fullName} />
          <ReadOnly label="Логин" value={user.login} />
          <ReadOnly label="Роль" value={ROLE_LABELS[user.role]} />
          <ReadOnly label="Должность" value={user.position} />
          <Typography variant="caption" color="text.secondary">
            ФИО и должность меняет администратор.
          </Typography>
          <form onSubmit={handleSubmit((d) => mutation.mutate(d))} noValidate>
            <Stack spacing={2}>
              <TextField label="Телефон" {...register('phone')} error={!!formState.errors.phone} helperText={formState.errors.phone?.message} />
              <TextField label="Email" type="email" {...register('email')} error={!!formState.errors.email} helperText={formState.errors.email?.message} />
              {mutation.isSuccess && <Alert severity="success">Сохранено</Alert>}
              {mutation.isError && <Alert severity="error">{errorMessage(mutation.error)}</Alert>}
              <Box>
                <Button type="submit" variant="contained" disabled={mutation.isPending}>
                  Сохранить
                </Button>
              </Box>
            </Stack>
          </form>
        </Stack>
      </Paper>
    </>
  );
}
