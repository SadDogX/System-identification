import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Navigate, useNavigate } from 'react-router-dom';
import { Alert, Box, Button, Paper, Stack, TextField, Typography } from '@mui/material';
import BadgeIcon from '@mui/icons-material/Badge';
import { useMutation } from '@tanstack/react-query';
import { loginRequestSchema, type LoginRequest } from '@app/shared';
import { errorMessage } from '../api/client';
import { homePath, useAuth } from '../auth/AuthContext';

export function AuthCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 2 }}>
      <Paper sx={{ p: { xs: 3, sm: 4 }, width: '100%', maxWidth: 400 }}>
        <Stack alignItems="center" spacing={1} sx={{ mb: 3 }}>
          <BadgeIcon color="primary" sx={{ fontSize: 40 }} />
          <Typography variant="h6" fontWeight={600} textAlign="center">
            {title}
          </Typography>
        </Stack>
        {children}
      </Paper>
    </Box>
  );
}

export function LoginPage() {
  const { user, login, initializing } = useAuth();
  const navigate = useNavigate();
  const { register, handleSubmit, formState } = useForm<LoginRequest>({ resolver: zodResolver(loginRequestSchema) });
  const mutation = useMutation({
    mutationFn: login,
    onSuccess: (u) => navigate(u.mustChangePassword ? '/change-password' : homePath(u), { replace: true }),
  });

  if (!initializing && user) return <Navigate to={homePath(user)} replace />;

  return (
    <AuthCard title="Учёт удостоверений сотрудников">
      <form onSubmit={handleSubmit((data) => mutation.mutate(data))} noValidate>
        <Stack spacing={2}>
          <TextField
            label="Логин"
            autoComplete="username"
            autoFocus
            {...register('login')}
            error={!!formState.errors.login}
            helperText={formState.errors.login?.message}
          />
          <TextField
            label="Пароль"
            type="password"
            autoComplete="current-password"
            {...register('password')}
            error={!!formState.errors.password}
            helperText={formState.errors.password?.message}
          />
          {mutation.isError && <Alert severity="error">{errorMessage(mutation.error)}</Alert>}
          <Button type="submit" variant="contained" size="large" disabled={mutation.isPending}>
            Войти
          </Button>
        </Stack>
      </form>
    </AuthCard>
  );
}
