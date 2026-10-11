import { Link as RouterLink } from 'react-router-dom';
import { Alert, Box, Button, Paper, Stack, Typography } from '@mui/material';
import { CREDENTIAL_STATUSES, STATUS_LABELS, type CredentialStatus } from '@app/shared';
import { useCurrentUser } from '../../auth/AuthContext';
import { CredentialCards } from '../../components/CredentialViews';
import { PageHeader } from '../../components/PageHeader';
import { StatusIcon } from '../../components/StatusBadge';
import { STATUS_COLORS } from '../../theme';
import { useOwnCredentials } from './UserCredentialsPage';

/** Ответ на вопрос: «Какие мои удостоверения действительны и какие нужно обновить?» */
export function UserDashboardPage() {
  const user = useCurrentUser();
  const { data = [] } = useOwnCredentials();

  const counts = Object.fromEntries(
    CREDENTIAL_STATUSES.map((s) => [s, data.filter((c) => c.status === s).length]),
  ) as Record<CredentialStatus, number>;
  const attention = data
    .filter((c) => c.status !== 'GREEN')
    // Сначала самые срочные, незаполненные в конце
    .sort((a, b) => (a.daysLeft ?? Infinity) - (b.daysLeft ?? Infinity));

  return (
    <>
      <PageHeader title={`Здравствуйте, ${user.fullName.split(' ').slice(1, 2).join('') || user.fullName}!`} />
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', mb: 3 }}>
        {CREDENTIAL_STATUSES.map((s) => (
          <Paper key={s} sx={{ p: 2, borderLeft: `4px solid ${STATUS_COLORS[s].border}` }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <StatusIcon status={s} />
              <Typography variant="body2" color="text.secondary">
                {STATUS_LABELS[s]}
              </Typography>
            </Stack>
            <Typography variant="h4" fontWeight={600} sx={{ mt: 1 }}>
              {counts[s]}
            </Typography>
          </Paper>
        ))}
      </Box>

      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h6">Требуют внимания</Typography>
        <Button component={RouterLink} to="/user/credentials">
          Все удостоверения
        </Button>
      </Stack>
      {data.length > 0 && attention.length === 0 ? (
        <Alert severity="success">Все удостоверения действительны. Обновлять ничего не нужно.</Alert>
      ) : (
        <CredentialCards items={attention} emptyText="Удостоверений пока нет" />
      )}
    </>
  );
}
