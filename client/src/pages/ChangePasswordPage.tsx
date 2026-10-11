import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { Alert, Button, Stack, TextField } from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import { changePasswordSchema, type AuthResponse } from '@app/shared';
import { api, errorDetails, errorMessage } from '../api/client';
import { homePath, useAuth, useCurrentUser } from '../auth/AuthContext';
import { AuthCard } from './LoginPage';

const formSchema = changePasswordSchema
  .extend({ confirm: z.string() })
  .refine((v) => v.newPassword === v.confirm, { message: 'Пароли не совпадают', path: ['confirm'] });
type Form = z.infer<typeof formSchema>;

export function ChangePasswordPage() {
  const user = useCurrentUser();
  const { applySession, logout } = useAuth();
  const navigate = useNavigate();
  const { register, handleSubmit, formState, setError } = useForm<Form>({ resolver: zodResolver(formSchema) });

  const mutation = useMutation({
    mutationFn: ({ currentPassword, newPassword }: Form) =>
      api.post<AuthResponse>('/auth/change-password', { currentPassword, newPassword }).then((r) => r.data),
    onSuccess: (session) => {
      applySession(session);
      navigate(homePath(session.user), { replace: true });
    },
    onError: (e) => {
      for (const [field, message] of Object.entries(errorDetails(e))) setError(field as keyof Form, { message });
    },
  });

  const field = (name: keyof Form, label: string, autoComplete: string) => (
    <TextField
      label={label}
      type="password"
      autoComplete={autoComplete}
      {...register(name)}
      error={!!formState.errors[name]}
      helperText={formState.errors[name]?.message}
    />
  );

  return (
    <AuthCard title={user.mustChangePassword ? 'Задайте постоянный пароль' : 'Смена пароля'}>
      {user.mustChangePassword && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Вы вошли с временным паролем. Придумайте новый, чтобы продолжить работу.
        </Alert>
      )}
      <form onSubmit={handleSubmit((data) => mutation.mutate(data))} noValidate>
        <Stack spacing={2}>
          {field('currentPassword', 'Текущий пароль', 'current-password')}
          {field('newPassword', 'Новый пароль (не менее 8 символов)', 'new-password')}
          {field('confirm', 'Повторите новый пароль', 'new-password')}
          {mutation.isError && !Object.keys(errorDetails(mutation.error)).length && (
            <Alert severity="error">{errorMessage(mutation.error)}</Alert>
          )}
          <Button type="submit" variant="contained" disabled={mutation.isPending}>
            Сохранить пароль
          </Button>
          {user.mustChangePassword ? (
            <Button onClick={() => logout().then(() => navigate('/login'))}>Выйти</Button>
          ) : (
            <Button onClick={() => navigate(-1)}>Назад</Button>
          )}
        </Stack>
      </form>
    </AuthCard>
  );
}
