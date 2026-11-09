import type { ReactNode } from 'react';
import { STATUS_MESSAGE_KEYS, CREDENTIAL_STATUSES, AUDIT_ACTION_LABELS, daysLeftText, formatDateRu, type DashboardDto } from '@app/shared';
import { useLanguage, translateText } from '../../core/i18n.tsx';
import { api } from '../../core/api.ts';
import { Icon, StatusBadge, StatusIcon, Alert, PageHeader } from '@app/shared/ui';
import { useQuery } from '../../core/data.ts';
import { Link, useRouter } from '../../core/router.tsx';
import { formatDateTime } from '../../core/utils.ts';
import { APP_MESSAGES, appMessage } from '../../core/appMessages.ts';

function Section({ title, link, children }: { title: string; link?: { to: string; label: string }; children: ReactNode }) {
  return <section className="panel pad"><div className="row between" style={{ marginBottom: 8 }}><h2 className="panel-title" style={{ margin: 0 }}>{title}</h2>{link && <Link to={link.to} className="btn btn-sm">{link.label}</Link>}</div>{children}</section>;
}

export function AdminDashboardPage() {
  const { navigate } = useRouter();
  const { language, t } = useLanguage();
  const m = (key: keyof typeof APP_MESSAGES.ru, values?: Record<string, string | number>) => appMessage(language, key, values);
  const { data, error } = useQuery('admin:dashboard', () => api.get<DashboardDto>('/admin/dashboard'));

  return <>
    <PageHeader title={m('dashboardTitle')} subtitle={m('dashboardSubtitle')} />
    {error && <Alert>{error}</Alert>}
    <div className="stats">
      <button type="button" className="stat" onClick={() => navigate('/admin/users')}><div className="stat-label"><Icon name="people" className="c-blue" />{m('allEmployees')}</div><div className="stat-value">{data?.totalUsers ?? '—'}</div></button>
      {CREDENTIAL_STATUSES.map((status) => <button key={status} type="button" className={`stat ${status}`} onClick={() => navigate(`/admin/credentials?status=${status}`)}><div className="stat-label"><StatusIcon status={status} />{t(STATUS_MESSAGE_KEYS[status])}</div><div className={`stat-value ${status === 'WHITE' ? '' : `c-${status}`}`}>{data?.counts[status] ?? '—'}</div></button>)}
    </div>
    <div className="two-cols">
      <Section title={m('upcomingExpiries')} link={{ to: '/admin/credentials?status=RED', label: m('allCritical') }}>
        {data?.upcoming.length === 0 ? <div className="empty">{m('noUpcoming')}</div> : <div className="table-wrap"><table className="table"><thead><tr><th>{m('employee')}</th><th>{m('credential')}</th><th>{m('due')}</th><th>{m('status')}</th></tr></thead><tbody>{data?.upcoming.map((credential) => <tr key={credential.id}><td><Link to={`/admin/users/${credential.userId}`}>{credential.user?.fullName}</Link></td><td>{credential.name}</td><td className="nowrap">{formatDateRu(credential.expiryDate)}</td><td><StatusBadge status={credential.status} daysLeft={credential.daysLeft} label={t(STATUS_MESSAGE_KEYS[credential.status])} daysText={daysLeftText(credential.daysLeft, language)} /></td></tr>)}</tbody></table></div>}
      </Section>
      <div className="stack">
        <Section title={m('criticalEmployees')} link={{ to: '/admin/users?filter=hasRed', label: m('allCritical') }}>
          {data?.criticalUsers.length === 0 && <div className="muted">{m('none')}</div>}
          <ul className="list">{data?.criticalUsers.map((employee) => <li key={employee.id} className="row" style={{ alignItems: 'flex-start' }}><StatusIcon status="RED" /><div><Link to={`/admin/users/${employee.id}`}>{employee.fullName}</Link><div className="muted small">{m('criticalCount', { count: employee.redCount, date: formatDateRu(employee.nearestExpiry) })}</div></div></li>)}</ul>
        </Section>
        <Section title={m('latestChanges')} link={{ to: '/admin/audit-log', label: m('journal') }}>
          <ul className="list">{data?.recentChanges.map((change) => <li key={change.id}><div>{change.actor?.fullName ?? m('system')}: {(AUDIT_ACTION_LABELS[change.action] ?? change.action).toLowerCase()}{change.targetUser && change.targetUser.id !== change.actor?.id ? ` — ${change.targetUser.fullName}` : ''}</div><div className="muted small">{formatDateTime(change.createdAt)}</div></li>)}</ul>
        </Section>
      </div>
    </div>
  </>;
}
