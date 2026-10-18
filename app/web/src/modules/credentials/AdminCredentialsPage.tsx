import { useState } from 'react';
import {
  CREDENTIAL_STATUSES,
  type CatalogItemDto,
  type CredentialStatus,
  type DashboardDto,
  type Paginated,
  type UserCredentialDto,
} from '@app/shared';
import { api } from '../../core/api.ts';
import { useAuth } from '../../core/auth.tsx';
import { useAdminCredentialActions } from './AdminCredentialActions.tsx';
import { CredentialView, ViewToggle, useViewMode } from './CredentialViews.tsx';
import { QuickFilters, type StatusFilter } from './QuickFilters.tsx';
import { Alert, Checkbox, PageHeader, Pager, SearchInput, SelectField } from '@app/shared/ui';
import { useQuery } from '../../core/data.ts';
import { useSearchParam } from '../../core/router.tsx';

export function AdminCredentialsPage() {
  const { settings } = useAuth();
  const [mode, setMode, isMobile] = useViewMode();
  const { renderActions, dialogs } = useAdminCredentialActions();
  const [q, setQ] = useState('');
  const [credentialId, setCredentialId] = useState('');
  const [marked, setMarked] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Статус живёт в URL — на отфильтрованный список можно дать ссылку (дашборд, сводка)
  const [rawStatus, setStatus] = useSearchParam('status');
  const status: StatusFilter = CREDENTIAL_STATUSES.includes(rawStatus as CredentialStatus) ? (rawStatus as CredentialStatus) : 'ALL';

  const catalog = useQuery('admin:catalog:active', () => api.get<CatalogItemDto[]>('/admin/catalog'));
  const dashboard = useQuery('admin:dashboard', () => api.get<DashboardDto>('/admin/dashboard'));
  const { data, error } = useQuery(`admin:credentials:${q}:${status}:${credentialId}:${marked}:${page}:${pageSize}`, () =>
    api.get<Paginated<UserCredentialDto>>('/admin/credentials', {
      q,
      status: status === 'ALL' ? undefined : status,
      credentialId,
      marked,
      page,
      pageSize,
    }),
  );

  return (
    <>
      <PageHeader title="Удостоверения" subtitle="Сначала ближайшие истечения" actions={<ViewToggle value={mode} onChange={setMode} hidden={isMobile} />} />
      <div className="stack mb">
        <QuickFilters
          value={status}
          thresholds={settings}
          counts={marked ? undefined : dashboard.data?.counts}
          onChange={(v) => {
            setStatus(v === 'ALL' ? null : v);
            setPage(1);
          }}
        />
        <div className="row wrap" style={{ alignItems: 'flex-end' }}>
          <SearchInput
            value={q}
            placeholder="Поиск: ФИО, логин, номер, удостоверение"
            onChange={(v) => {
              setQ(v);
              setPage(1);
            }}
          />
          <div style={{ minWidth: 260 }}>
            <SelectField
              label="Удостоверение"
              value={credentialId}
              onChange={(e) => {
                setCredentialId(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Все</option>
              {catalog.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </SelectField>
          </div>
          <Checkbox
            label="Помеченные на удаление"
            checked={marked}
            onChange={(v) => {
              setMarked(v);
              setPage(1);
            }}
          />
        </div>
      </div>

      {error && <Alert>{error}</Alert>}
      <CredentialView mode={mode} items={data?.items ?? []} showUser actions={renderActions} emptyText="Ничего не найдено" />
      <div className={mode === 'table' ? '' : 'panel'} style={{ marginTop: mode === 'table' ? 0 : 16 }}>
        <Pager
          total={data?.total ?? 0}
          page={page}
          pageSize={pageSize}
          sizes={[50, 100, 200]}
          onPage={setPage}
          onPageSize={(s) => {
            setPageSize(s);
            setPage(1);
          }}
        />
      </div>
      {dialogs}
    </>
  );
}
