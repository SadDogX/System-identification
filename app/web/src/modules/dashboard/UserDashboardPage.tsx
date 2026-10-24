import { CREDENTIAL_STATUSES, STATUS_LABELS, WORK_DAY_STATUSES, type CredentialStatus, type WorkDayStatus, type WorkScheduleDto } from '@app/shared';
import { useCurrentUser } from '../../core/auth.tsx';
import { CredentialCards } from '../credentials/CredentialViews.tsx';
import { StatusIcon, Alert, PageHeader } from '@app/shared/ui';
import { Link } from '../../core/router.tsx';
import { useOwnCredentials } from '../credentials/UserCredentialsPage.tsx';
import { api } from '../../core/api.ts';
import { useQuery } from '../../core/data.ts';

const SCHEDULE_LABELS: Record<WorkDayStatus, string> = { WORK: 'работа', FREE_SHIFT: 'свободная вахта', TRAVEL: 'дорога', SICK_LEAVE: 'больничный', VACATION: 'отпуск', TRAINING: 'учёба' };

export function UserDashboardPage() {
  const user = useCurrentUser();
  const { data = [] } = useOwnCredentials();
  const { data: schedule } = useQuery(`schedule:home:${user.id}`, () => api.get<WorkScheduleDto>('/me/work-schedule', { year: new Date().getFullYear() }));
  const counts = Object.fromEntries(CREDENTIAL_STATUSES.map((s) => [s, data.filter((c) => c.status === s).length])) as Record<CredentialStatus, number>;
  const attention = data.filter((c) => c.status !== 'GREEN').sort((a, b) => (a.daysLeft ?? Infinity) - (b.daysLeft ?? Infinity));
  const firstName = user.fullName.split(' ')[1] || user.fullName;
  return <><PageHeader title={`Здравствуйте, ${firstName}!`} />{schedule && <section className="panel schedule-home"><div className="row between"><h2 className="panel-title">График работы</h2><Link to="/user/work-schedule" className="btn btn-sm">Открыть график</Link></div><div className="schedule-home-stats">{WORK_DAY_STATUSES.map((s) => <span key={s}><b>{schedule.stats[s]}</b> {SCHEDULE_LABELS[s]}</span>)}</div></section>}<div className="stats">{CREDENTIAL_STATUSES.map((s) => <div key={s} className={`stat ${s}`}><div className="stat-label"><StatusIcon status={s} />{STATUS_LABELS[s]}</div><div className="stat-value">{counts[s]}</div></div>)}</div><div className="row between mb"><h2 style={{ fontSize: 18, fontWeight: 600 }}>Требуют внимания</h2><Link to="/user/credentials" className="btn">Все удостоверения</Link></div>{data.length > 0 && attention.length === 0 ? <Alert kind="success">Все удостоверения действительны. Обновлять ничего не нужно.</Alert> : <CredentialCards items={attention} emptyText="Удостоверений пока нет" />}</>;
}
