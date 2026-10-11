import { useState } from 'react';
import { Alert, Button, Paper } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import { useQuery } from '@tanstack/react-query';
import type { UserCredentialDto } from '@app/shared';
import { api } from '../../api/client';
import { CredentialView, ViewToggle } from '../../components/CredentialViews';
import { PageHeader } from '../../components/PageHeader';
import { UserCredentialDialog } from '../../components/UserCredentialDialog';
import { useViewMode } from '../../hooks/useViewMode';

export const useOwnCredentials = () =>
  useQuery({
    queryKey: ['me', 'credentials'],
    queryFn: () => api.get<UserCredentialDto[]>('/me/credentials').then((r) => r.data),
  });

export function UserCredentialsPage() {
  const [mode, setMode, isMobile] = useViewMode();
  const { data = [], isError } = useOwnCredentials();
  const [dialog, setDialog] = useState<{ open: boolean; id: number | null }>({ open: false, id: null });

  return (
    <>
      <PageHeader
        title="Мои удостоверения"
        subtitle="Укажите дату выдачи — дата окончания рассчитается по сроку из справочника"
        actions={
          <>
            <ViewToggle value={mode} onChange={setMode} hidden={isMobile} />
            <Button variant="contained" startIcon={<EditIcon />} onClick={() => setDialog({ open: true, id: null })} disabled={!data.length}>
              Внести данные
            </Button>
          </>
        }
      />
      {isError && <Alert severity="error">Не удалось загрузить удостоверения</Alert>}
      <Paper sx={{ p: mode === 'cards' ? 2 : 0, ...(mode === 'cards' && { bgcolor: 'transparent', border: 'none', p: 0 }) }}>
        <CredentialView
          mode={mode}
          items={data}
          emptyText="Администратор ещё не добавил удостоверения в справочник"
          actions={(item) => (
            <Button size="small" startIcon={<EditIcon />} onClick={() => setDialog({ open: true, id: item.id })}>
              {item.issueDate ? 'Изменить' : 'Заполнить'}
            </Button>
          )}
        />
      </Paper>
      <UserCredentialDialog open={dialog.open} initialId={dialog.id} credentials={data} onClose={() => setDialog({ open: false, id: null })} />
    </>
  );
}
