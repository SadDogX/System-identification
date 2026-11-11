import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlannedWorkSchedulePage } from './PlannedWorkSchedulePage.tsx';
import { useCurrentUser } from '../../core/auth.tsx';
import { api } from '../../core/api.ts';

vi.mock('../../core/auth.tsx', () => ({ useCurrentUser: vi.fn() }));
vi.mock('../../core/api.ts', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
  errorMessage: (error: unknown) => String(error),
}));

const row = {
  id: 11,
  baseId: 1,
  locationType: 'WELL',
  mineId: 20,
  clusterNumber: 'K1',
  wellId: 30,
  workTypeId: 4,
  name: 'Detailed work',
  description: null,
  startsAt: '2026-01-02',
  endsAt: '2026-01-03',
  coordinatorEmployeeId: 5,
  supervisorEmployeeId: 6,
  base: { id: 1, name: 'North Base' },
  mine: { id: 20, name: 'Field', baseId: 1, base: { id: 1, name: 'North Base' } },
  well: { id: 30, name: 'Well 1' },
  workType: { id: 4, name: 'Drilling' },
  status: { id: 1, code: 'PLANNED', name: 'Planned' },
  coordinator: { id: 5, user: { id: 7, name: 'Coordinator' } },
  supervisor: { id: 6, user: { id: 8, name: 'Supervisor' } },
  employees: [{ employee: { id: 6, user: { id: 8, name: 'Supervisor' } } }],
  segments: [{ startsAt: '2026-01-02', endsAt: '2026-01-03', conflict: false }],
  conflictDates: [],
};

function setup() {
  vi.mocked(useCurrentUser).mockReturnValue({
    id: 7, fullName: 'Test Admin', login: 'test.admin', systemRoles: ['ADMIN'], positionId: null, position: null,
    phone: null, email: null, photoMime: null, photoFile: null, isActive: true, mustChangePassword: false,
    uiSettings: {}, createdAt: '2026-01-01T00:00:00.000Z',
  });
  vi.mocked(api.get).mockImplementation(async (path: string) => {
    if (path === '/planned-work/options') return {
      bases: [{ id: 1, name: 'North Base' }],
      mines: [{ id: 20, name: 'Field', baseId: 1, base: { id: 1, name: 'North Base' } }],
      coordinators: [{ id: 5, fullName: 'Coordinator', baseIds: [1], mineIds: [20] }],
      employees: [{ id: 5, fullName: 'Manager', baseIds: [1] }, { id: 6, fullName: 'Supervisor', baseIds: [1] }],
      workTypes: [{ id: 4, name: 'Drilling' }],
      statuses: [{ id: 1, code: 'PLANNED', name: 'Planned' }, { id: 2, code: 'IN_PROGRESS', name: 'In progress' }],
      selfEmployeeId: null,
    } as never;
    if (path === '/planned-work') return { year: 2026, rows: [row] } as never;
    if (path === '/planned-work/11') return row as never;
    if (path === '/org/mines/20/wells') return [{ id: 30, name: 'Well 1', clusterNumber: 'K1' }] as never;
    throw new Error(`Unexpected GET ${path}`);
  });
  vi.mocked(api.patch).mockResolvedValue(row as never);
  vi.mocked(api.post).mockResolvedValue(row as never);
  render(<PlannedWorkSchedulePage />);
}

afterEach(() => cleanup());

describe('PlannedWorkSchedulePage', () => {
  it('updates status from the unified calendar view', async () => {
    setup();

    await screen.findByRole('button', { name: 'Detailed work' });
    fireEvent.click(screen.getByRole('button', { name: 'Detailed work' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Начать' }));

    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/planned-work/11/status', { statusCode: 'IN_PROGRESS' }));
  });

  it('creates a base-level work plan from the calendar form', async () => {
    setup();
    const user = userEvent.setup();

    fireEvent.click(await screen.findByRole('button', { name: 'Запланировать работу' }));
    await screen.findByRole('option', { name: 'North Base' });
    fireEvent.change(screen.getByLabelText('Наименование *'), { target: { value: 'Base maintenance' } });
    fireEvent.change(screen.getByLabelText('Вид работ *'), { target: { value: '4' } });
    fireEvent.change(screen.getByLabelText('База *'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('Место работ *'), { target: { value: 'BASE' } });
    fireEvent.change(screen.getByLabelText('Ответственный *'), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText('Руководитель работ *'), { target: { value: '6' } });
    await user.selectOptions(screen.getByLabelText('Участники работ *'), ['5', '6']);
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/planned-work', expect.objectContaining({
      name: 'Base maintenance',
      baseId: 1,
      locationType: 'BASE',
      workTypeId: 4,
      employeeIds: [5, 6],
    })));
  });
});
