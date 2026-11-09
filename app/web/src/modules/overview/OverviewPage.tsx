import { useState } from 'react';
import { STATUS_MESSAGE_KEYS, daysLeftText, formatDateRu, type OverviewDto, type PositionDto } from '@app/shared';
import { useLanguage } from '../../core/i18n.tsx';
import { api } from '../../core/api.ts';
import { StatusDot, Alert, Checkbox, PageHeader, SearchInput, SelectField } from '@app/shared/ui';
import { useQuery } from '../../core/data.ts';
import { Link } from '../../core/router.tsx';
import { APP_MESSAGES, appMessage } from '../../core/appMessages.ts';

export function OverviewPage() {
  const [query, setQuery] = useState('');
  const [positionId, setPositionId] = useState('');
  const [onlyAttention, setOnlyAttention] = useState(false);
  const { language, t } = useLanguage();
  const m = (key: keyof typeof APP_MESSAGES.ru) => appMessage(language, key);
  const positions = useQuery('admin:positions:active', () => api.get<PositionDto[]>('/admin/positions'));
  const { data, error, loading } = useQuery(`admin:overview:${query}:${positionId}`, () => api.get<OverviewDto>('/admin/overview', { q: query, positionId }));
  const rows = (data?.rows ?? []).filter((row) => !onlyAttention || Object.values(row.cells).some((cell) => !cell.marked && (cell.status === 'RED' || cell.status === 'YELLOW')));
  return <>
    <PageHeader title={m('generalInfo')} subtitle={m('credentialsDeadlineTable')} />
    <div className="row wrap mb" style={{ alignItems: 'flex-end' }}>
      <SearchInput value={query} onChange={setQuery} placeholder={m('searchName')} />
      <div style={{ minWidth: 220 }}><SelectField label={m('commonPosition')} value={positionId} onChange={(event) => setPositionId(event.target.value)}>
        <option value="">{m('allPositions')}</option>{positions.data?.map((position) => <option key={position.id} value={position.id}>{position.name}</option>)}
      </SelectField></div>
      <Checkbox label={m('allAttentionOnly')} checked={onlyAttention} onChange={setOnlyAttention} />
    </div>
    <div className="row wrap mb small muted">{(['GREEN', 'YELLOW', 'RED', 'WHITE'] as const).map((status) => <span key={status} className="row"><StatusDot status={status} /> {t(STATUS_MESSAGE_KEYS[status])}</span>)}</div>
    {error && <Alert>{error}</Alert>}
    <div className="panel overview-wrap"><table className="overview"><thead><tr><th className="sticky-col">{m('commonEmployee')}</th>{data?.credentials.map((credential) => <th key={credential.id}>{credential.name}</th>)}</tr></thead>
      <tbody>{rows.map((row) => <tr key={row.user.id}><th className="sticky-col" scope="row"><Link to={`/admin/users/${row.user.id}`}>{row.user.fullName}</Link>{row.user.position && <div className="muted small">{row.user.position}</div>}</th>
        {data?.credentials.map((credential) => {
          const cell = row.cells[credential.id];
          if (!cell || cell.marked) return <td key={credential.id} className="cell-none" title={m(cell?.marked ? 'markedForDeletion' : 'noRecord')}>×</td>;
          return <td key={credential.id} className={`cell s-${cell.status}`} title={`${credential.name}: ${cell.expiryDate ? daysLeftText(cell.daysLeft, language) : t('status.notFilled')}`}>{formatDateRu(cell.expiryDate)}</td>;
        })}</tr>)}</tbody>
    </table>{!loading && rows.length === 0 && <div className="empty">{m('noEmployees')}</div>}</div>
  </>;
}
