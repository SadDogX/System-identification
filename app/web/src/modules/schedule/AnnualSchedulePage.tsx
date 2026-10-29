import { useState } from 'react';
import type { WorkDayStatus, WorkScheduleAnnualDto } from '@app/shared';
import { api } from '../../core/api.ts';
import { useQuery } from '../../core/data.ts';
import { useRouter } from '../../core/router.tsx';
import { Alert, TextField } from '@app/shared/ui';
import { ScheduleControlPanel, getScheduleDates, getScheduleMonthName, WORK_SCHEDULE_CODES, WORK_SCHEDULE_COLORS } from '../../widgets/schedule';

const holidays = new Set(['01-01', '01-02', '01-03', '01-04', '01-05', '01-06', '01-07', '01-08', '02-23', '03-08', '05-01', '05-09', '06-12', '11-04']);
const weekend = (date: string) => [0, 6].includes(new Date(`${date}T00:00:00Z`).getUTCDay());

export function AnnualSchedulePage() {
  const { navigate } = useRouter();
  const [year, setYear] = useState(new Date().getFullYear());
  const [collapsed, setCollapsed] = useState(false);
  const { data, error } = useQuery(`schedule:annual:${year}`, () =>
    api.get<WorkScheduleAnnualDto>('/admin/work-schedule/annual', { year }),
  );
  const allDays = getScheduleDates(year);
  const months = Array.from({ length: 12 }, (_, month) =>
    allDays.filter((date) => new Date(`${date}T00:00:00Z`).getUTCMonth() === month),
  );

  return (
    <>
      <ScheduleControlPanel
        title="Общий график сотрудников"
        subtitle="Все сотрудники за выбранный год"
        collapsed={collapsed}
        onToggle={() => setCollapsed((value) => !value)}
      >
        <div className="row mb">
          <TextField label="Год" type="number" value={year} onChange={(event) => setYear(Number(event.target.value))} />
        </div>
      </ScheduleControlPanel>
      {error && <Alert>{error}</Alert>}
      <div className="annual-schedule-wrap">
        <div className="annual-schedule-scrollbar" aria-hidden="true" />
        <table className="annual-schedule">
          <thead>
            <tr>
              <th className="annual-name" rowSpan={2}>
                ФИО
              </th>
              {months.map((month, index) => (
                <th className={`annual-month month-${index % 2}`} key={index} colSpan={month.length}>
                  {getScheduleMonthName(index)}
                </th>
              ))}
            </tr>
            <tr>
              {months.flatMap((month, index) =>
                month.map((date) => (
                  <th
                    className={`annual-day-head month-${index % 2}${holidays.has(date.slice(5)) ? ' holiday' : ''}${weekend(date) ? ' weekend' : ''}`}
                    key={date}
                  >
                    {Number(date.slice(8, 10))}
                  </th>
                )),
              )}
            </tr>
          </thead>
          <tbody>
            {data?.rows.map((row) => {
              const statusByDate = new Map(row.entries.map((entry) => [entry.date, entry.status]));
              return (
                <tr key={row.user.id}>
                  <th
                    className="annual-name annual-person"
                    onClick={() => navigate(`/admin/work-schedule/calendar?userId=${row.user.id}`)}
                  >
                    {row.user.fullName}
                  </th>
                  {allDays.map((date) => {
                    const status = statusByDate.get(date);
                    const month = Number(date.slice(5, 7)) - 1;
                    return (
                      <td
                        className={`month-${month % 2}${holidays.has(date.slice(5)) ? ' holiday' : ''}${weekend(date) ? ' weekend' : ''}`}
                        key={date}
                        style={{
                          background: status ? WORK_SCHEDULE_COLORS[status] : undefined,
                          color: status && status !== 'TRAVEL' ? '#fff' : 'var(--text)',
                        }}
                        title={status ? WORK_SCHEDULE_CODES[status] : 'Не задано'}
                      >
                        {status ? WORK_SCHEDULE_CODES[status] : ''}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
