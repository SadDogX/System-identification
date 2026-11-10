import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { countScheduleDaysByStatus, expandScheduleIntervals, groupScheduleDates, groupScheduleDays } from './scheduleIntervals.ts';

describe('schedule interval helpers', () => {
  it('groups only adjacent days with the same employee and status', () => {
    const intervals = groupScheduleDays([
      { userId: 2, date: '2024-01-02', status: 'WORK' },
      { userId: 1, date: '2024-01-01', status: 'WORK' },
      { userId: 1, date: '2024-01-02', status: 'WORK' },
      { userId: 1, date: '2024-01-04', status: 'WORK' },
      { userId: 1, date: '2024-01-05', status: 'VACATION' },
    ]);

    assert.deepEqual(intervals, [
      { userId: 1, startDate: '2024-01-01', endDate: '2024-01-02', status: 'WORK' },
      { userId: 1, startDate: '2024-01-04', endDate: '2024-01-04', status: 'WORK' },
      { userId: 1, startDate: '2024-01-05', endDate: '2024-01-05', status: 'VACATION' },
      { userId: 2, startDate: '2024-01-02', endDate: '2024-01-02', status: 'WORK' },
    ]);
  });

  it('expands across a leap day and clips at calendar-year boundaries', () => {
    const intervals = [
      { userId: 1, startDate: '2023-12-30', endDate: '2024-03-01', status: 'WORK' as const },
      { userId: 1, startDate: '2024-03-02', endDate: '2024-03-03', status: 'VACATION' as const },
    ];
    const expanded = expandScheduleIntervals(intervals, '2024-01-01', '2024-12-31');

    assert.equal(expanded.size, 63);
    assert.equal(expanded.get('2024-02-29'), 'WORK');
    assert.equal(expanded.get('2024-03-03'), 'VACATION');
    assert.equal(countScheduleDaysByStatus(intervals, '2024-01-01', '2024-12-31').WORK, 61);
  });

  it('groups unique deleted dates into inclusive consecutive ranges', () => {
    assert.deepEqual(groupScheduleDates(['2024-02-29', '2024-03-01', '2024-03-03', '2024-03-01']), [
      { startDate: '2024-02-29', endDate: '2024-03-01' },
      { startDate: '2024-03-03', endDate: '2024-03-03' },
    ]);
  });
});
