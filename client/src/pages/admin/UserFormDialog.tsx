import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  TextField,
} from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createUserSchema, updateUserSchema, type UserDto } from '@app/shared';
import { api, errorDetails, errorMessage } from '../../api/client';
import { useCurrentUser } from '../../auth/AuthContext';
import { ROLE_LABELS } from '../../utils';

interface Form {
  fullName: string;
  login: string;
  password: string;
  role: 'ADMIN' | 'USER';
  position: string;
  phone: string;
  email: string;
  isActive: boolean;
}

interface Props {
  open: boolean;
  /** Не задан — создание нового пользователя. */
  user?: UserDto;
  onClose: () => void;
}

export function UserFormDialog({ open, user, onClose }: Props) {
  const me = useCurrentUser();
  const queryClient = useQueryClient();
  const isEdit = !!user;
  const isSelf = user?.id === me.id;

  const { register, handleSubmit, control, reset, setError, formState } = useForm<Form>({
    resolver: zodResolver(isEdit ? updateUserSchema : createUserSchema) as never,
  });

  useEffect(() => {
    if (!open) return;
    reset({
      fullName: user?.fullName ?? '',
      login: user?.login ?? '',
      password: '',
      role: user?.role ?? 'USER',
      position: user?.position ?? '',
      phone: user?.phone ?? '',
      email: user?.email ?? '',
      isActive: user?.isActive ?? true,
    });
  }, [open, user, reset]);

  const mutation = useMutation({
    mutationFn: async (data: Form) => {
      if (isEdit) {
        await api.patch(`/admin/users/${user!.id}`, {
          fullName: data.fullName,
          role: data.role,
          position: data.position,
          phone: data.phone,
          email: data.email,
          isActive: data.isActive,
        });
      } else {
        await api.post('/admin/users', data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin'] });
      onClose();
    },
    onError: (e) => {
      for (const [field, message] of Object.entries(errorDetails(e))) setError(field as keyof Form, { message });
    },
  });

  const err = (name: keyof Form) => ({ error: !!formState.errors[name], helperText: formState.errors[name]?.message });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} noValidate>
        <DialogTitle>{isEdit ? 'Редактирование пользователя' : 'Новый пользователь'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField label="ФИО" required {...register('fullName')} {...err('fullName')} />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField label="Логин" required disabled={isEdit} {...register('login')} {...err('login')} />
              {!isEdit && (
                <TextField
                  label="Временный пароль"
                  required
                  {...register('password')}
                  {...err('password')}
                  helperText={formState.errors.password?.message ?? 'Пользователь сменит его при первом входе'}
                />
              )}
            </Stack>
            <Controller
              name="role"
              control={control}
              render={({ field }) => (
                <TextField
                  select
                  label="Роль"
                  {...field}
                  disabled={isSelf}
                  helperText={isSelf ? 'Собственную роль изменить нельзя' : 'Удостоверения ведутся только у сотрудников'}
                >
                  {(['USER', 'ADMIN'] as const).map((r) => (
                    <MenuItem key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
            <TextField label="Должность" {...register('position')} {...err('position')} />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField label="Телефон" {...register('phone')} {...err('phone')} />
              <TextField label="Email" type="email" {...register('email')} {...err('email')} />
            </Stack>
            {isEdit && (
              <Controller
                name="isActive"
                control={control}
                render={({ field }) => (
                  <FormControlLabel
                    control={<Switch checked={field.value} onChange={(e) => field.onChange(e.target.checked)} disabled={isSelf} />}
                    label={field.value ? 'Активен' : 'Заблокирован'}
                  />
                )}
              />
            )}
            {mutation.isError && !Object.keys(errorDetails(mutation.error)).length && (
              <Alert severity="error">{errorMessage(mutation.error)}</Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Отмена</Button>
          <Button type="submit" variant="contained" disabled={mutation.isPending}>
            {isEdit ? 'Сохранить' : 'Создать'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
