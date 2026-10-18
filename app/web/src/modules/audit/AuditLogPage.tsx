import { useState } from 'react';
import { AUDIT_ACTION_LABELS, AUDIT_FIELD_LABELS, formatDateRu, isIsoDate, type AuditLogDto, type Paginated } from '@app/shared';
import { api } from '../../core/api.ts';
import { Alert, PageHeader, Pager, SelectField } from '@app/shared/ui';
import { useQuery } from '../../core/data.ts';
import { Link } from '../../core/router.tsx';
import { ROLE_LABELS, formatDateTime } from '../../core/utils.ts';

const ENTITY_TYPES = [
  { value: '', label: 'Все объекты' },
  { value: 'UserCredential', label: 'Удостоверения' },
  { value: 'User', label: 'Пользователи' },
  { value: 'Credential', label: 'Справочник удостоверений' },
  { value: 'Position', label: 'Справочник должностей' },
  { value: 'Message', label: 'Сообщения' },
];

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'да' : 'нет';
  if (typeof value === 'string' && isIsoDate(value)) return formatDateRu(value);
  if (value === 'ADMIN' || value === 'USER') return ROLE_LABELS[value];
  return String(value);
}

function DiffView({ diff }: { diff: AuditLogDto['diff'] }) {
  if (!diff || Object.keys(diff).length === 0) return <>—</>;
  return (
    <div className="diff">
      {Object.entries(diff).map(([field, { from, to }]) => (
        <div key={field}>
          <b>{AUDIT_FIELD_LABELS[field] ?? field}:</b>{' '}
          {from !== null && from !== undefined && (
            <>
              <del>{formatValue(from)}</del> →{' '}
            </>
          )}
          {formatValue(to)}
        </div>
      ))}
    </div>
  );
}

export function AuditLogPage() {
  const [entityType, setEntityType] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(30);

  const { data, error } = useQuery(`admin:audit:${entityType}:${page}:${pageSize}`, () =>
    api.get<Paginated<AuditLogDto>>('/admin/audit-log', { entityType, page, pageSize }),
  );

  return (
    <>
      <PageHeader title="Журнал действий" subtitle="Кто, что и когда изменил" />
      {error && <Alert>{error}</Alert>}
      <div className="panel">
        <div style={{ padding: 16, maxWidth: 312 }}>
          <SelectField
            label="Объект"
            value={entityType}
            onChange={(e) => {
              setEntityType(e.target.value);
              setPage(1);
            }}
          >
            {ENTITY_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </SelectField>
        </div>
        <div className="table-wrap">
          <table className="table top">
            <thead>
              <tr>
                <th>Когда</th>
                <th>Кто</th>
                <th>Что</th>
                <th>Кого</th>
                <th>Изменение</th>
              </tr>
            </thead>
            <tbody>
              {data?.items.map((a) => (
                <tr key={a.id}>
                  <td className="nowrap">{formatDateTime(a.createdAt)}</td>
                  <td>{a.actor?.fullName ?? 'Система'}</td>
                  <td>{AUDIT_ACTION_LABELS[a.action] ?? a.action}</td>
                  <td>{a.targetUser ? <Link to={`/admin/users/${a.targetUser.id}`}>{a.targetUser.fullName}</Link> : '—'}</td>
                  <td>
                    <DiffView diff={a.diff} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data?.items.length === 0 && <div className="empty">Записей нет</div>}
        </div>
        <Pager
          total={data?.total ?? 0}
          page={page}
          pageSize={pageSize}
          sizes={[30, 50, 100]}
          onPage={setPage}
          onPageSize={(s) => {
            setPageSize(s);
            setPage(1);
          }}
        />
      </div>
    </>
  );
}
