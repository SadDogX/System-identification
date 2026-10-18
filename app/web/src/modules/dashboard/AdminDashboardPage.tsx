import type { ReactNode } from 'react';
import { AUDIT_ACTION_LABELS, CREDENTIAL_STATUSES, STATUS_LABELS, formatDateRu, type DashboardDto } from '@app/shared';
import { api } from '../../core/api.ts';
import { Icon, StatusBadge, StatusIcon, Alert, PageHeader } from '@app/shared/ui';
import { useQuery } from '../../core/data.ts';
import { Link, useRouter } from '../../core/router.tsx';
import { formatDateTime } from '../../core/utils.ts';

function Section({ title, link, children }: { title: string; link?: { to: string; label: string }; children: ReactNode }) {
  return (
    <section className="panel pad">
      <div className="row between" style={{ marginBottom: 8 }}>
        <h2 className="panel-title" style={{ margin: 0 }}>
          {title}
        </h2>
        {link && (
          <Link to={link.to} className="btn btn-sm">
            {link.label}
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

/** Главный вопрос: «У кого какие удостоверения заканчиваются и когда?» */
export function AdminDashboardPage() {
  const { navigate } = useRouter();
  const { data, error } = useQuery('admin:dashboard', () => api.get<DashboardDto>('/admin/dashboard'));

  return (
    <>
      <PageHeader title="Дашборд" subtitle="Кто требует внимания и какие сроки подходят к концу" />
      {error && <Alert>{error}</Alert>}

      <div className="stats">
        <button type="button" className="stat" onClick={() => navigate('/admin/users')}>
          <div className="stat-label">
            <Icon name="people" className="c-blue" />
            Сотрудников
          </div>
          <div className="stat-value">{data?.totalUsers ?? '—'}</div>
        </button>
        {CREDENTIAL_STATUSES.map((s) => (
          <button key={s} type="button" className={`stat ${s}`} onClick={() => navigate(`/admin/credentials?status=${s}`)}>
            <div className="stat-label">
              <StatusIcon status={s} />
              {STATUS_LABELS[s]}
            </div>
            <div className={`stat-value ${s === 'WHITE' ? '' : `c-${s}`}`}>{data?.counts[s] ?? '—'}</div>
          </button>
        ))}
      </div>

      <div className="two-cols">
        <Section title="Ближайшие истечения" link={{ to: '/admin/credentials?status=RED', label: 'Все критичные' }}>
          {data?.upcoming.length === 0 ? (
            <div className="empty">В ближайшее время сроки не истекают</div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Сотрудник</th>
                    <th>Удостоверение</th>
                    <th>До</th>
                    <th>Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.upcoming.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <Link to={`/admin/users/${c.userId}`}>{c.user?.fullName}</Link>
                      </td>
                      <td>{c.name}</td>
                      <td className="nowrap">{formatDateRu(c.expiryDate)}</td>
                      <td>
                        <StatusBadge status={c.status} daysLeft={c.daysLeft} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        <div className="stack">
          <Section title="Сотрудники с критичными сроками" link={{ to: '/admin/users?filter=hasRed', label: 'Все' }}>
            {data?.criticalUsers.length === 0 && <div className="muted">Таких нет</div>}
            <ul className="list">
              {data?.criticalUsers.map((u) => (
                <li key={u.id} className="row" style={{ alignItems: 'flex-start' }}>
                  <StatusIcon status="RED" />
                  <div>
                    <Link to={`/admin/users/${u.id}`}>{u.fullName}</Link>
                    <div className="muted small">
                      Критичных: {u.redCount} · ближайшее до {formatDateRu(u.nearestExpiry)}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Последние изменения" link={{ to: '/admin/audit-log', label: 'Журнал' }}>
            <ul className="list">
              {data?.recentChanges.map((a) => (
                <li key={a.id}>
                  <div>
                    {a.actor?.fullName ?? 'Система'}: {(AUDIT_ACTION_LABELS[a.action] ?? a.action).toLowerCase()}
                    {a.targetUser && a.targetUser.id !== a.actor?.id ? ` — ${a.targetUser.fullName}` : ''}
                  </div>
                  <div className="muted small">{formatDateTime(a.createdAt)}</div>
                </li>
              ))}
            </ul>
          </Section>
        </div>
      </div>
    </>
  );
}
