import { useState } from 'react';
import { USER_LIST_FILTERS, type CredentialStatus, type Paginated, type PositionDto, type UserListItemDto } from '@app/shared';
import { api } from '../../core/api.ts';
import { StatusDot, Alert, PageHeader, Pager, SearchInput, SelectField } from '@app/shared/ui';
import { useQuery } from '../../core/data.ts';
import { Link, useRouter, useSearchParam } from '../../core/router.tsx';
import { useLanguage } from '../../core/i18n.tsx';
import { APP_MESSAGES, appMessage } from '../../core/appMessages.ts';
import { UserFormDialog } from './UserFormDialog.tsx';

type Filter = (typeof USER_LIST_FILTERS)[number];
const FILTER_KEYS: Record<Filter, keyof typeof APP_MESSAGES.ru> = { all: 'allFilter', hasRed: 'hasRed', hasYellow: 'hasYellow', hasWhite: 'hasWhite' };

function CountChip({ status, count }: { status: CredentialStatus; count: number }) {
  if (!count) return null;
  return <span className={`chip small s-${status}`} style={{ fontWeight: 600 }}><StatusDot status={status} />{count}</span>;
}

export function UsersPage() {
  const { navigate } = useRouter();
  const { language, t } = useLanguage();
  const m = (key: keyof typeof APP_MESSAGES.ru) => appMessage(language, key);
  const [rawFilter, setFilter] = useSearchParam('filter');
  const filter: Filter = (USER_LIST_FILTERS as readonly string[]).includes(rawFilter ?? '') ? (rawFilter as Filter) : 'all';
  const [positionId, setPositionId] = useSearchParam('position');
  const positions = useQuery('admin:positions:active', () => api.get<PositionDto[]>('/admin/positions'));
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [createOpen, setCreateOpen] = useState(false);
  const { data, error } = useQuery(`admin:users:${query}:${filter}:${positionId}:${page}:${pageSize}`, () => api.get<Paginated<UserListItemDto>>('/admin/users', { q: query, filter, positionId, page, pageSize }));
  return <>
    <PageHeader title={t('navigation.employeeDirectory')} actions={<button type="button" className="btn btn-primary" onClick={() => setCreateOpen(true)}>{t('common.addEmployee')}</button>} />
    {error && <Alert>{error}</Alert>}
    <div className="panel"><div className="row wrap" style={{ padding: 16, alignItems: 'flex-end' }}>
      <SearchInput value={query} placeholder={m('searchByName')} onChange={(value) => { setQuery(value); setPage(1); }} />
      <div style={{ minWidth: 220 }}><SelectField label={m('allFilter')} value={filter} onChange={(event) => { setFilter(event.target.value === 'all' ? null : event.target.value); setPage(1); }}>{USER_LIST_FILTERS.map((item) => <option key={item} value={item}>{m(FILTER_KEYS[item])}</option>)}</SelectField></div>
      <div style={{ minWidth: 220 }}><SelectField label={t('common.position')} value={positionId ?? ''} onChange={(event) => { setPositionId(event.target.value || null); setPage(1); }}><option value="">{m('allPositions')}</option>{positions.data?.map((position) => <option key={position.id} value={position.id}>{position.name}</option>)}</SelectField></div>
    </div>
    <div className="table-wrap"><table className="table"><thead><tr><th>{t('common.fullName')}</th><th>{t('auth.login')}</th><th>{t('common.position')}</th><th>{t('common.status')}</th><th>{t('common.credentials')}</th><th>{t('common.date')}</th></tr></thead><tbody>{data?.items.map((user) => <tr key={user.id} className="clickable" onClick={() => navigate(`/admin/users/${user.id}`)}>
      <td><Link to={`/admin/users/${user.id}`}>{user.fullName}</Link>{user.position && <div className="muted small">{user.position}</div>}</td><td>{user.login}</td><td>{user.position ?? user.systemRoles.map((role) => t(`roles.${role}`)).join(', ')}</td>
      <td><span className={`chip small ${user.isActive ? '' : 'danger'}`}>{user.isActive ? t('common.active') : t('common.blocked')}</span></td>
      <td><div className="row" title={`${t('common.title')}: ${user.counts.total}`}><CountChip status="RED" count={user.counts.RED} /><CountChip status="YELLOW" count={user.counts.YELLOW} /><CountChip status="GREEN" count={user.counts.GREEN} /><CountChip status="WHITE" count={user.counts.WHITE} /></div></td>
      <td>{new Date(user.createdAt).toLocaleDateString(language === 'ru' ? 'ru-RU' : 'en-GB')}</td>
    </tr>)}</tbody></table>{data?.items.length === 0 && <div className="empty">{m('noEmployees')}</div>}</div>
    <Pager total={data?.total ?? 0} page={page} pageSize={pageSize} sizes={[20, 50, 100]} onPage={setPage} onPageSize={(size) => { setPageSize(size); setPage(1); }} />
    </div>
    <UserFormDialog open={createOpen} mode="create" onClose={() => setCreateOpen(false)} />
  </>;
}
