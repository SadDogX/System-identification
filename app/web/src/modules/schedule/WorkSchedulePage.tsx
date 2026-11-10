import { useEffect, useState, type PointerEvent, type WheelEvent } from 'react';
import type { UserDto, WorkDayStatus, WorkScheduleIntervalsDto } from '@app/shared';
import { groupScheduleDates, groupScheduleDays, expandScheduleIntervals, WORK_DAY_STATUSES } from '@app/shared';
import { api } from '../../core/api.ts';
import { useQuery, useAction, invalidate } from '../../core/data.ts';
import { useRouter } from '../../core/router.tsx';
import { Alert, SelectField } from '@app/shared/ui';
import { ScheduleControlPanel, WorkScheduleCalendar, WorkScheduleLegend, getScheduleDates } from '../../widgets/schedule';

const yearTabs = (year: number) => [year, year + 1, ...Array.from({ length: 5 }, (_, index) => year - index - 1)];

export function WorkSchedulePage({ admin = false, team = false }: { admin?: boolean; team?: boolean }) {
  const { search } = useRouter();
  const initialUser = search.get('userId') ?? '';
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [selectedUser, setSelectedUser] = useState(initialUser);
  const [selected, setSelected] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const [anchor, setAnchor] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [draft, setDraft] = useState<Map<string, WorkDayStatus> | null>(null);
  const [deleted, setDeleted] = useState<Set<string>>(new Set());

  const save = useAction(async () => {
    if (!draft) return;
    const root = `${team ? '/team' : '/admin'}/work-schedule`;
    for (const range of groupScheduleDates([...deleted])) {
      await api.delete(`${root}/intervals/${selectedUser}`, range);
    }
    const changed = groupScheduleDays([...draft]
      .filter(([date, status]) => !deleted.has(date) && saved.get(date) !== status)
      .map(([date, status]) => ({ userId: Number(selectedUser), date, status })));
    for (const interval of changed) {
      await api.put(`${root}/intervals/${selectedUser}`, {
        startDate: interval.startDate,
        endDate: interval.endDate,
        status: interval.status,
      });
    }
    setDraft(null);
    setDeleted(new Set());
    invalidate('schedule');
  });
  const canEdit = admin || team;
  const users = useQuery(canEdit ? `schedule:users:${team}` : null, () => api.get<UserDto[]>(team ? '/team/work-schedule/users' : '/admin/work-schedule/users'));
  const path = team ? '/team/work-schedule' : admin ? '/admin/work-schedule' : '/me/work-schedule';
  const { data, error } = useQuery(`schedule:${admin}:${team}:${selectedUser}:${year}`, () =>
    api.get<WorkScheduleIntervalsDto>(`${path}/intervals`, { userId: selectedUser, year }),
  );
  const saved = expandScheduleIntervals(data?.intervals ?? [], `${year}-01-01`, `${year}-12-31`);
  const map = draft ?? saved;

  useEffect(() => {
  if (!canEdit || selectedUser || !users.data?.length) return;

  setSelectedUser(String(users.data[0].id));
}, [canEdit, selectedUser, users.data]);


  useEffect(() => {
    const stop = () => setDragging(false);
    window.addEventListener('pointerup', stop);
    return () => window.removeEventListener('pointerup', stop);
  }, []);

  const select = (date: string, event: PointerEvent<HTMLButtonElement>) => {
    if (!canEdit || !selectedUser) return;
    if (event.ctrlKey || event.metaKey) {
      setSelected((current) => (current.includes(date) ? current.filter((item) => item !== date) : [...current, date]));
    } else {
      setAnchor(date);
      setSelected([date]);
    }
    setDragging(true);
  };
  const enter = (date: string) => {
    if (!dragging || !anchor) return;
    const allDates = getScheduleDates(year);
    const start = allDates.indexOf(anchor);
    const end = allDates.indexOf(date);
    setSelected(allDates.slice(Math.min(start, end), Math.max(start, end) + 1));
  };
  const wheel = (event: WheelEvent<HTMLButtonElement>, date: string) => {
    if (!canEdit || !selectedUser) return;
    event.preventDefault();
    const targets = selected.length ? selected : [date];
    const current = map.get(targets[0]);
    const next =
      WORK_DAY_STATUSES[
        ((current ? WORK_DAY_STATUSES.indexOf(current) : 0) + (event.deltaY < 0 ? 1 : -1) + WORK_DAY_STATUSES.length) %
          WORK_DAY_STATUSES.length
      ];
    setDraft((currentDraft) => {
      const nextMap = new Map(currentDraft ?? map);
      targets.forEach((target) => nextMap.set(target, next));
      return nextMap;
    });
  };
  const clearSelected = () => {
    setDeleted((current) => new Set([...current, ...selected]));
    setDraft((current) => {
      const next = new Map(current ?? map);
      selected.forEach((date) => next.delete(date));
      return next;
    });
  };

  return (
    <>
      <ScheduleControlPanel
        title={canEdit ? 'График сотрудника' : 'Мой график'}
        subtitle="Удерживайте Shift для диапазона, Ctrl для отдельных дат. Колесо меняет статус."
        collapsed={collapsed}
        onToggle={() => setCollapsed((value) => !value)}
      >
        <div className="schedule-year-tabs">
          {yearTabs(currentYear).map((tabYear, index) => (
            <button
              key={tabYear}
              type="button"
              className={`schedule-year-tab${year === tabYear ? ' active' : ''}`}
              onClick={() => {
                setYear(tabYear);
                setSelected([]);
                setDraft(null);
              }}
            >
              {index > 1 ? `${tabYear} Архив` : tabYear}
            </button>
          ))}
        </div>
        {canEdit && (
          <div className="row wrap mb">
            <SelectField
              label="Сотрудник"
              value={selectedUser}
              onChange={(event) => {
                setSelectedUser(event.target.value);
                setSelected([]);
                setDraft(null);
              }}
            >
              <option value="">Выберите сотрудника</option>
              {users.data?.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.fullName}
                </option>
              ))}
            </SelectField>
            {selected.length > 0 && (
              <>
                <span className="chip primary">Выбрано: {selected.length}</span>
                <button type="button" className="btn btn-danger" onClick={clearSelected}>
                  Очистить
                </button>
              </>
            )}
          </div>
        )}
        <WorkScheduleLegend />
        {error && <Alert>{error}</Alert>}
        {draft && (
          <div className="row">
            <button type="button" className="btn btn-primary" disabled={save.pending} onClick={() => save.run()}>
              Сохранить изменения
            </button>
            <button type="button" className="btn" onClick={() => setDraft(null)}>
              Отменить
            </button>
            {save.pending && <span className="muted">Сохранение…</span>}
          </div>
        )}
      </ScheduleControlPanel>
      {canEdit && !selectedUser ? (
        <div className="empty">Выберите сотрудника для редактирования графика.</div>
      ) : (
        data && (
          <WorkScheduleCalendar
            year={year}
            statuses={map}
            selectedDates={selected}
            onPointerDown={select}
            onPointerEnter={enter}
            onWheel={wheel}
          />
        )
      )}
    </>
  );
}
