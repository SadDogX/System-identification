import type { PointerEvent, WheelEvent } from 'react';
import { WORK_DAY_STATUSES, type WorkDayStatus } from '@app/shared';
import { useLanguage } from '../../core/i18n.tsx';
import { APP_MESSAGES, APP_WEEKDAYS, appMessage } from '../../core/appMessages.ts';
import { getScheduleDates, getScheduleMonthName, WORK_SCHEDULE_CODES, WORK_SCHEDULE_COLORS, WORK_SCHEDULE_LABELS } from './schedulePresentation';

interface WorkScheduleCalendarProps {
  year: number;
  statuses: Map<string, WorkDayStatus>;
  selectedDates: string[];
  onPointerDown: (date: string, event: PointerEvent<HTMLButtonElement>) => void;
  onPointerEnter: (date: string) => void;
  onWheel: (event: WheelEvent<HTMLButtonElement>, date: string) => void;
}

export function WorkScheduleLegend() {
  const { language } = useLanguage();
  const m = (key: keyof typeof APP_MESSAGES.ru) => appMessage(language, key);
  return (
    <div className="schedule-legend schedule-legend-top">
      <strong>{m('statuses')}:</strong>
      {WORK_DAY_STATUSES.map((status) => (
        <span className="schedule-legend-item" key={status}>
          <i style={{ background: WORK_SCHEDULE_COLORS[status] }}>{WORK_SCHEDULE_CODES[status]}</i>
          {WORK_SCHEDULE_CODES[status]} — {WORK_SCHEDULE_LABELS[status]}
        </span>
      ))}
    </div>
  );
}

export function WorkScheduleCalendar({
  year,
  statuses,
  selectedDates,
  onPointerDown,
  onPointerEnter,
  onWheel,
}: WorkScheduleCalendarProps) {
  const { language } = useLanguage();
  const m = (key: keyof typeof APP_MESSAGES.ru) => appMessage(language, key);
  const weekdays = APP_WEEKDAYS[language];
  const dates = getScheduleDates(year);

  return (
    <div className="schedule-grid">
      {Array.from({ length: 12 }, (_, month) => {
        const monthDates = dates.filter((date) => new Date(`${date}T00:00:00Z`).getUTCMonth() === month);
        const firstWeekday = (new Date(`${monthDates[0]}T00:00:00Z`).getUTCDay() + 6) % 7;

        return (
          <section className="panel schedule-month" key={month}>
            <h3>{getScheduleMonthName(month)}</h3>
            <div className="schedule-weekdays">
              {weekdays.map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>
            <div className="schedule-days">
              {Array.from({ length: firstWeekday }, (_, index) => (
                <span className="schedule-day empty-day" key={`empty-${index}`} />
              ))}
              {monthDates.map((date) => {
                const status = statuses.get(date);

                return (
                  <button
                    key={date}
                    type="button"
                    className={`schedule-day${selectedDates.includes(date) ? ' selected' : ''}`}
                    style={{
                      background: status ? WORK_SCHEDULE_COLORS[status] : 'var(--surface)',
                      color: status === 'TRAVEL' || !status ? 'var(--text)' : '#fff',
                    }}
                    onPointerDown={(event) => onPointerDown(date, event)}
                    onPointerEnter={() => onPointerEnter(date)}
                    onWheel={(event) => onWheel(event, date)}
                    title={`${date}: ${status ? WORK_SCHEDULE_LABELS[status] : m('scheduleNotSet')}`}
                  >
                    <span className="schedule-day-number">{Number(date.slice(8, 10))}</span>
                    {status && <span className="schedule-status-code">{WORK_SCHEDULE_CODES[status]}</span>}
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
