import { useEffect, useRef, useState } from 'react';
import type { WorkDayStatus, WorkScheduleAnnualDto } from '@app/shared';
import { api } from '../../core/api.ts';
import { useQuery } from '../../core/data.ts';
import { useRouter } from '../../core/router.tsx';
import { Alert, TextField } from '@app/shared/ui';
import { ScheduleControlPanel, getScheduleDates, getScheduleMonthName, WORK_SCHEDULE_CODES, WORK_SCHEDULE_COLORS } from '../../widgets/schedule';

const holidays = new Set(['01-01', '01-02', '01-03', '01-04', '01-05', '01-06', '01-07', '01-08', '02-23', '03-08', '05-01', '05-09', '06-12', '11-04']);
const weekend = (date: string) => [0, 6].includes(new Date(`${date}T00:00:00Z`).getUTCDay());
const weekday = (date: string) => new Intl.DateTimeFormat('ru-RU', { weekday: 'short', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`));

export function AnnualSchedulePage({ team = false }: { team?: boolean }) {
  const { navigate } = useRouter();
  const [year, setYear] = useState(new Date().getFullYear());
  const [collapsed, setCollapsed] = useState(false);
  const scrollHost = useRef<HTMLDivElement>(null);
  const scrollBar = useRef<HTMLDivElement>(null);
  const scrollTrack = useRef<HTMLDivElement>(null);
  const schedulePath = team ? '/team/work-schedule/annual' : '/admin/work-schedule/annual';
  const { data, error } = useQuery(`schedule:annual:${team}:${year}`, () =>
    api.get<WorkScheduleAnnualDto>(schedulePath, { year }),
  );
  useEffect(() => {
    const viewport = scrollHost.current;
    const bar = scrollBar.current;
    const track = scrollTrack.current;
    if (!viewport || !bar || !track) return;
    const syncWidth = () => { track.style.width = `${viewport.scrollWidth}px`; };
    const fromViewport = () => { bar.scrollLeft = viewport.scrollLeft; };
    const fromBar = () => { viewport.scrollLeft = bar.scrollLeft; };
    syncWidth();
    viewport.addEventListener('scroll', fromViewport);
    bar.addEventListener('scroll', fromBar);
    const observer = new ResizeObserver(syncWidth);
    observer.observe(viewport);
    const table = viewport.querySelector('table');
    if (table) observer.observe(table);
    return () => {
      viewport.removeEventListener('scroll', fromViewport);
      bar.removeEventListener('scroll', fromBar);
      observer.disconnect();
    };
  }, [data, year]);
  const allDays = getScheduleDates(year);
  const months = Array.from({ length: 12 }, (_, month) =>
    allDays.filter((date) => new Date(`${date}T00:00:00Z`).getUTCMonth() === month),
  );

  return (
    <>
      <ScheduleControlPanel title={team ? 'Общий график команды' : 'Общий график сотрудников'} subtitle={team ? 'Сотрудники в вашей зоне ответственности' : 'Все сотрудники за выбранный год'} collapsed={collapsed} onToggle={() => setCollapsed((value) => !value)}>
        <div className="row mb"><TextField label="Год" type="number" value={year} onChange={(event) => setYear(Number(event.target.value))} /></div>
      </ScheduleControlPanel>
      {error && <Alert>{error}</Alert>}
      <div className="annual-schedule-scroll-host">
        <div ref={scrollBar} className="annual-schedule-scrollbar" role="scrollbar" aria-label="Горизонтальная прокрутка общего графика" aria-controls="annual-schedule-table" tabIndex={0}>
          <div ref={scrollTrack} className="annual-schedule-scrollbar-track" />
        </div>
        <div ref={scrollHost} className="annual-schedule-wrap">
          <table id="annual-schedule-table" className="annual-schedule">
            <thead>
              <tr>
                <th className="annual-name" rowSpan={3}>ФИО</th>
                {months.map((month, index) => <th className={`annual-month month-${index % 2}`} key={index} colSpan={month.length}>{getScheduleMonthName(index)}</th>)}
              </tr>
              <tr>
                {months.flatMap((month, index) => month.map((date) => <th className={`annual-day-head month-${index % 2}`} key={`weekday-${date}`}>{weekday(date)}</th>))}
              </tr>
              <tr>
                {months.flatMap((month, index) => month.map((date) => <th className={`annual-day-head month-${index % 2}${holidays.has(date.slice(5)) ? ' holiday' : ''}${weekend(date) ? ' weekend' : ''}`} key={date}>{Number(date.slice(8, 10))}</th>))}
              </tr>
            </thead>
            <tbody>
              {data?.rows.map((row) => {
                const statusByDate = new Map<string, WorkDayStatus>(row.entries.map((entry) => [entry.date, entry.status]));
                return <tr key={row.user.id}>
                  <th className="annual-name annual-person" onClick={() => navigate(`${team ? '/admin/team-work-schedule/calendar' : '/admin/work-schedule/calendar'}?userId=${row.user.id}`)}>{row.user.fullName}</th>
                  {allDays.map((date) => {
                    const status = statusByDate.get(date);
                    const month = Number(date.slice(5, 7)) - 1;
                    return <td className={`month-${month % 2}${holidays.has(date.slice(5)) ? ' holiday' : ''}${weekend(date) ? ' weekend' : ''}`} key={date}
                      style={{ background: status ? WORK_SCHEDULE_COLORS[status] : undefined, color: status && status !== 'TRAVEL' ? '#fff' : 'var(--text)' }}
                      title={`${weekday(date)} ${Number(date.slice(8, 10))}: ${status ? WORK_SCHEDULE_CODES[status] : 'Не задано'}`}>
                      {status ? WORK_SCHEDULE_CODES[status] : ''}
                    </td>;
                  })}
                </tr>;
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
