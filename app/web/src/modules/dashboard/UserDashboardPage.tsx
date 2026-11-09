import { CREDENTIAL_STATUSES, STATUS_MESSAGE_KEYS, WORK_DAY_STATUSES, type CredentialStatus, type WorkDayStatus, type WorkScheduleDto } from '@app/shared';
import { useLanguage } from '../../core/i18n.tsx';
import { useCurrentUser } from '../../core/auth.tsx';
import { CredentialCards } from '../credentials/CredentialViews.tsx';
import { StatusIcon, Alert, PageHeader } from '@app/shared/ui';
import { Link } from '../../core/router.tsx';
import { useOwnCredentials } from '../credentials/UserCredentialsPage.tsx';
import { api } from '../../core/api.ts';
import { useQuery } from '../../core/data.ts';
import { APP_MESSAGES, appMessage } from '../../core/appMessages.ts';

const SCHEDULE_KEYS: Record<WorkDayStatus, keyof typeof APP_MESSAGES.ru> = { WORK: 'workDayWork', FREE_SHIFT: 'workDayFreeShift', TRAVEL: 'workDayTravel', SICK_LEAVE: 'workDaySickLeave', VACATION: 'workDayVacation', TRAINING: 'workDayTraining' };

export function UserDashboardPage() {
  const user = useCurrentUser();
  const { language, t } = useLanguage();
  const m = (key: keyof typeof APP_MESSAGES.ru, values?: Record<string, string | number>) => appMessage(language, key, values);
  const { data = [] } = useOwnCredentials();
  const { data: schedule } = useQuery(`schedule:home:${user.id}`, () => api.get<WorkScheduleDto>('/me/work-schedule', { year: new Date().getFullYear() }));
  const counts = Object.fromEntries(CREDENTIAL_STATUSES.map((status) => [status, data.filter((item) => item.status === status).length])) as Record<CredentialStatus, number>;
  const attention = data.filter((item) => item.status !== 'GREEN').sort((a, b) => (a.daysLeft ?? Infinity) - (b.daysLeft ?? Infinity));
  const firstName = user.fullName.split(' ')[1] || user.fullName;
  return <>
    <PageHeader title={m('hello', { name: firstName })} />
    {schedule && <section className="panel schedule-home"><div className="row between"><h2 className="panel-title">{m('workSchedule')}</h2><Link to="/user/work-schedule" className="btn btn-sm">{m('openSchedule')}</Link></div><div className="schedule-home-stats">{WORK_DAY_STATUSES.map((status) => <span key={status}><b>{schedule.stats[status]}</b> {m(SCHEDULE_KEYS[status])}</span>)}</div></section>}
    <div className="stats">{CREDENTIAL_STATUSES.map((status) => <div key={status} className={`stat ${status}`}><div className="stat-label"><StatusIcon status={status} />{t(STATUS_MESSAGE_KEYS[status])}</div><div className="stat-value">{counts[status]}</div></div>)}</div>
    <div className="row between mb"><h2 style={{ fontSize: 18, fontWeight: 600 }}>{m('needAttention')}</h2><Link to="/user/credentials" className="btn">{m('allCredentials')}</Link></div>
    {data.length > 0 && attention.length === 0 ? <Alert kind="success">{m('allCredentialsValid')}</Alert> : <CredentialCards items={attention} emptyText={m('noCredentials')} />}
  </>;
}
