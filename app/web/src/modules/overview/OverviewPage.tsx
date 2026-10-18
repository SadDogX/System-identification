import { useState } from 'react';
import { STATUS_LABELS, daysLeftText, formatDateRu, type OverviewDto, type PositionDto } from '@app/shared';
import { api } from '../../core/api.ts';
import { StatusDot, Alert, Checkbox, PageHeader, SearchInput, SelectField } from '@app/shared/ui';
import { useQuery } from '../../core/data.ts';
import { Link } from '../../core/router.tsx';

/** «Общие сведения»: сотрудники по строкам, удостоверения по столбцам, в ячейках дата окончания с цветом статуса. */
export function OverviewPage() {
  const [q, setQ] = useState('');
  const [positionId, setPositionId] = useState('');
  const [onlyAttention, setOnlyAttention] = useState(false);

  const positions = useQuery('admin:positions:active', () => api.get<PositionDto[]>('/admin/positions'));
  const { data, error, loading } = useQuery(`admin:overview:${q}:${positionId}`, () =>
    api.get<OverviewDto>('/admin/overview', { q, positionId }),
  );

  const rows = (data?.rows ?? []).filter(
    (r) => !onlyAttention || Object.values(r.cells).some((c) => !c.marked && (c.status === 'RED' || c.status === 'YELLOW')),
  );

  return (
    <>
      <PageHeader title="Общие сведения" subtitle="Сроки действия удостоверений всех сотрудников в одной таблице" />
      <div className="row wrap mb" style={{ alignItems: 'flex-end' }}>
        <SearchInput value={q} onChange={setQ} placeholder="Поиск по ФИО" />
        <div style={{ minWidth: 220 }}>
          <SelectField label="Должность" value={positionId} onChange={(e) => setPositionId(e.target.value)}>
            <option value="">Все должности</option>
            {positions.data?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </SelectField>
        </div>
        <Checkbox label="Только требующие внимания" checked={onlyAttention} onChange={setOnlyAttention} />
      </div>
      <div className="row wrap mb small muted">
        {(['GREEN', 'YELLOW', 'RED', 'WHITE'] as const).map((s) => (
          <span key={s} className="row">
            <StatusDot status={s} /> {STATUS_LABELS[s]}
          </span>
        ))}
      </div>

      {error && <Alert>{error}</Alert>}
      <div className="panel overview-wrap">
        <table className="overview">
          <thead>
            <tr>
              <th className="sticky-col">Сотрудник</th>
              {data?.credentials.map((c) => (
                <th key={c.id}>{c.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.user.id}>
                <th className="sticky-col" scope="row">
                  <Link to={`/admin/users/${r.user.id}`}>{r.user.fullName}</Link>
                  {r.user.position && <div className="muted small">{r.user.position}</div>}
                </th>
                {data?.credentials.map((c) => {
                  const cell = r.cells[c.id];
                  if (!cell || cell.marked) {
                    return (
                      <td key={c.id} className="cell-none" title={cell?.marked ? 'Помечено на удаление' : 'Нет записи'}>
                        ×
                      </td>
                    );
                  }
                  return (
                    <td
                      key={c.id}
                      className={`cell s-${cell.status}`}
                      title={`${c.name}: ${cell.expiryDate ? daysLeftText(cell.daysLeft) : 'не заполнено'}`}
                    >
                      {formatDateRu(cell.expiryDate)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && rows.length === 0 && <div className="empty">Сотрудники не найдены</div>}
      </div>
    </>
  );
}
