import { CREDENTIAL_STATUSES, STATUS_LABELS, type CredentialStatus } from '@app/shared';
import { useCurrentUser } from '../../core/auth.tsx';
import { CredentialCards } from '../credentials/CredentialViews.tsx';
import { StatusIcon, Alert, PageHeader } from '@app/shared/ui';
import { Link } from '../../core/router.tsx';
import { useOwnCredentials } from '../credentials/UserCredentialsPage.tsx';

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
  const firstName = user.fullName.split(' ')[1] || user.fullName;

  return (
    <>
      <PageHeader title={`Здравствуйте, ${firstName}!`} />
      <div className="stats">
        {CREDENTIAL_STATUSES.map((s) => (
          <div key={s} className={`stat ${s}`}>
            <div className="stat-label">
              <StatusIcon status={s} />
              {STATUS_LABELS[s]}
            </div>
            <div className="stat-value">{counts[s]}</div>
          </div>
        ))}
      </div>

      <div className="row between mb">
        <h2 style={{ fontSize: 18, fontWeight: 600 }}>Требуют внимания</h2>
        <Link to="/user/credentials" className="btn">
          Все удостоверения
        </Link>
      </div>
      {data.length > 0 && attention.length === 0 ? (
        <Alert kind="success">Все удостоверения действительны. Обновлять ничего не нужно.</Alert>
      ) : (
        <CredentialCards items={attention} emptyText="Удостоверений пока нет" />
      )}
    </>
  );
}
