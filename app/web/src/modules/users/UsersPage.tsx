import { useState } from 'react';
import { USER_LIST_FILTERS, type CredentialStatus, type Paginated, type PositionDto, type UserListItemDto } from '@app/shared';
import { api } from '../../core/api.ts';
import { Icon, StatusDot, Alert, PageHeader, Pager, SearchInput, SelectField } from '@app/shared/ui';
import { useQuery } from '../../core/data.ts';
import { Link, useRouter, useSearchParam } from '../../core/router.tsx';
import { ROLE_LABELS } from '../../core/utils.ts';
import { UserFormDialog } from './UserFormDialog.tsx';

type Filter = (typeof USER_LIST_FILTERS)[number];

const FILTER_LABELS: Record<Filter, string> = {
  all: 'Все',
  USER: 'Сотрудники',
  ADMIN: 'Администраторы',
  hasRed: 'Есть красные',
  hasYellow: 'Есть жёлтые',
  hasWhite: 'Есть незаполненные',
};

function CountChip({ status, count }: { status: CredentialStatus; count: number }) {
  if (!count) return null;
  return (
    <span className={`chip small s-${status}`} style={{ fontWeight: 600 }}>
      <StatusDot status={status} />
      {count}
    </span>
  );
}

export function UsersPage() {
  const { navigate } = useRouter();
  const [rawFilter, setFilter] = useSearchParam('filter');
  const filter: Filter = (USER_LIST_FILTERS as readonly string[]).includes(rawFilter ?? '') ? (rawFilter as Filter) : 'all';
  const [positionId, setPositionId] = useSearchParam('position');
  const positions = useQuery('admin:positions:active', () => api.get<PositionDto[]>('/admin/positions'));
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [createOpen, setCreateOpen] = useState(false);

  const { data, error } = useQuery(`admin:users:${q}:${filter}:${positionId}:${page}:${pageSize}`, () =>
    api.get<Paginated<UserListItemDto>>('/admin/users', { q, filter, positionId, page, pageSize }),
  );

  return (
    <>
      <PageHeader
        title="Справочник сотрудников"
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setCreateOpen(true)}>
            <Icon name="add" small /> Добавить сотрудника
          </button>
        }
      />
      {error && <Alert>{error}</Alert>}
      <div className="panel">
        <div className="row wrap" style={{ padding: 16, alignItems: 'flex-end' }}>
          <SearchInput
            value={q}
            placeholder="Поиск по ФИО или логину"
            onChange={(v) => {
              setQ(v);
              setPage(1);
            }}
          />
          <div style={{ minWidth: 220 }}>
            <SelectField
              label="Фильтр"
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value === 'all' ? null : e.target.value);
                setPage(1);
              }}
            >
              {USER_LIST_FILTERS.map((f) => (
                <option key={f} value={f}>
                  {FILTER_LABELS[f]}
                </option>
              ))}
            </SelectField>
          </div>
          <div style={{ minWidth: 220 }}>
            <SelectField
              label="Должность"
              value={positionId ?? ''}
              onChange={(e) => {
                setPositionId(e.target.value || null);
                setPage(1);
              }}
            >
              <option value="">Все должности</option>
              {positions.data?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </SelectField>
          </div>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>ФИО</th>
                <th>Логин</th>
                <th>Роль</th>
                <th>Статус</th>
                <th>Удостоверения</th>
                <th>Создан</th>
              </tr>
            </thead>
            <tbody>
              {data?.items.map((u) => (
                <tr key={u.id} className="clickable" onClick={() => navigate(`/admin/users/${u.id}`)}>
                  <td>
                    <Link to={`/admin/users/${u.id}`}>{u.fullName}</Link>
                    {u.position && <div className="muted small">{u.position}</div>}
                  </td>
                  <td>{u.login}</td>
                  <td>{ROLE_LABELS[u.role]}</td>
                  <td>
                    <span className={`chip small ${u.isActive ? '' : 'danger'}`}>{u.isActive ? 'Активен' : 'Заблокирован'}</span>
                  </td>
                  <td>
                    {u.role === 'USER' ? (
                      <div className="row" title={`Всего: ${u.counts.total}`}>
                        <CountChip status="RED" count={u.counts.RED} />
                        <CountChip status="YELLOW" count={u.counts.YELLOW} />
                        <CountChip status="GREEN" count={u.counts.GREEN} />
                        <CountChip status="WHITE" count={u.counts.WHITE} />
                      </div>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>{new Date(u.createdAt).toLocaleDateString('ru-RU')}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data?.items.length === 0 && <div className="empty">Никого не найдено</div>}
        </div>
        <Pager
          total={data?.total ?? 0}
          page={page}
          pageSize={pageSize}
          sizes={[20, 50, 100]}
          onPage={setPage}
          onPageSize={(s) => {
            setPageSize(s);
            setPage(1);
          }}
        />
      </div>
      <UserFormDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  );
}
