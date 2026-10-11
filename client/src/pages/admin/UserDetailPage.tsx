import { useState } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import { Alert, Box, Button, Chip, Paper, Stack, TextField, Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditIcon from '@mui/icons-material/Edit';
import KeyIcon from '@mui/icons-material/Key';
import DeleteIcon from '@mui/icons-material/Delete';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UserCredentialDto, UserDto } from '@app/shared';
import { api, errorMessage } from '../../api/client';
import { useCurrentUser } from '../../auth/AuthContext';
import { useAdminCredentialActions } from '../../components/AdminCredentialActions';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { CredentialView, ViewToggle } from '../../components/CredentialViews';
import { PageHeader } from '../../components/PageHeader';
import { useViewMode } from '../../hooks/useViewMode';
import { ROLE_LABELS } from '../../utils';
import { UserFormDialog } from './UserFormDialog';

function Info({ label, value }: { label: string; value: string | null }) {
  return (
    <Box sx={{ minWidth: 160 }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography>{value || '—'}</Typography>
    </Box>
  );
}

export function UserDetailPage() {
  const id = Number(useParams().id);
  const me = useCurrentUser();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [mode, setMode, isMobile] = useViewMode();
  const { renderActions, dialogs } = useAdminCredentialActions();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');

  const { data, isError } = useQuery({
    queryKey: ['admin', 'user', id],
    queryFn: () => api.get<{ user: UserDto; credentials: UserCredentialDto[] }>(`/admin/users/${id}`).then((r) => r.data),
  });

  const remove = useMutation({
    mutationFn: () => api.delete(`/admin/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin'] });
      navigate('/admin/users');
    },
  });
  const reset = useMutation({
    mutationFn: () => api.post(`/admin/users/${id}/reset-password`, { password: newPassword }),
    onSuccess: () => setResetOpen(false),
  });

  if (isError) return <Alert severity="error">Пользователь не найден</Alert>;
  if (!data) return null;
  const { user, credentials } = data;
  const isSelf = user.id === me.id;

  return (
    <>
      <Button component={RouterLink} to="/admin/users" startIcon={<ArrowBackIcon />} sx={{ mb: 1 }}>
        Пользователи
      </Button>
      <PageHeader
        title={user.fullName}
        subtitle={`${ROLE_LABELS[user.role]} · ${user.login}`}
        actions={
          <>
            <Button variant="outlined" startIcon={<EditIcon />} onClick={() => setEditOpen(true)}>
              Редактировать
            </Button>
            <Button variant="outlined" startIcon={<KeyIcon />} onClick={() => { setNewPassword(''); reset.reset(); setResetOpen(true); }}>
              Сбросить пароль
            </Button>
            {!isSelf && (
              <Button variant="outlined" color="error" startIcon={<DeleteIcon />} onClick={() => setDeleteOpen(true)}>
                Удалить
              </Button>
            )}
          </>
        }
      />
      {reset.isSuccess && <Alert severity="success" sx={{ mb: 2 }}>Пароль сброшен. Пользователь сменит его при следующем входе.</Alert>}

      <Paper sx={{ p: 2, mb: 3 }}>
        <Stack direction="row" spacing={3} useFlexGap flexWrap="wrap">
          <Info label="Должность" value={user.position} />
          <Info label="Телефон" value={user.phone} />
          <Info label="Email" value={user.email} />
          <Box>
            <Typography variant="caption" color="text.secondary" display="block">
              Статус
            </Typography>
            <Chip size="small" label={user.isActive ? 'Активен' : 'Заблокирован'} color={user.isActive ? 'success' : 'error'} variant="outlined" />
          </Box>
        </Stack>
      </Paper>

      {user.role === 'USER' && (
        <>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Typography variant="h6">Удостоверения</Typography>
            <ViewToggle value={mode} onChange={setMode} hidden={isMobile} />
          </Stack>
          <Paper sx={mode === 'cards' ? { bgcolor: 'transparent', border: 'none' } : undefined}>
            <CredentialView mode={mode} items={credentials} actions={renderActions} emptyText="Справочник удостоверений пуст" />
          </Paper>
        </>
      )}

      {dialogs}
      <UserFormDialog open={editOpen} user={user} onClose={() => setEditOpen(false)} />
      <ConfirmDialog
        open={deleteOpen}
        title="Удалить пользователя?"
        text={remove.isError ? errorMessage(remove.error) : `${user.fullName} пропадёт из списков и не сможет войти. Данные и история сохранятся в базе.`}
        confirmText="Удалить"
        danger
        loading={remove.isPending}
        onConfirm={() => remove.mutate()}
        onClose={() => setDeleteOpen(false)}
      />
      <ConfirmDialog
        open={resetOpen}
        title="Сброс пароля"
        text={reset.isError ? errorMessage(reset.error) : 'Задайте временный пароль и передайте его пользователю. Все его текущие сессии завершатся.'}
        confirmText="Сбросить"
        loading={reset.isPending || newPassword.length < 8}
        onConfirm={() => reset.mutate()}
        onClose={() => setResetOpen(false)}
      >
        <TextField
          autoFocus
          label="Временный пароль (не менее 8 символов)"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          sx={{ mt: 2 }}
        />
      </ConfirmDialog>
    </>
  );
}
