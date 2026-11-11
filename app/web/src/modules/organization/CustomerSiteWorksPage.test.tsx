import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { CustomerSiteWorksPage } from './CustomerSiteWorksPage.tsx';
import { useCurrentUser } from '../../core/auth.tsx';
import { api } from '../../core/api.ts';

vi.mock('../../core/auth.tsx', () => ({ useCurrentUser: vi.fn() }));
vi.mock('../../core/api.ts', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn(), upload: vi.fn(), blob: vi.fn() },
  errorMessage: (error: unknown) => String(error),
}));

afterEach(() => cleanup());

describe('CustomerSiteWorksPage execution history', () => {
  it('loads and displays actual executions for the selected customer site work', async () => {
    vi.mocked(useCurrentUser).mockReturnValue({
      id: 7, fullName: 'Test Admin', login: 'test.admin', systemRoles: ['ADMIN'], positionId: null, position: null,
      phone: null, email: null, photoMime: null, photoFile: null, isActive: true, mustChangePassword: false,
      uiSettings: {}, createdAt: '2026-01-01T00:00:00.000Z',
    });
    vi.mocked(api.get).mockImplementation(async (path: string) => {
      if (path === '/org/users/7/employee') return { user: { systemRoles: [] } } as never;
      if (path === '/org/customer-site-works/options') return { customers: [], mines: [], supervisors: [] } as never;
      if (path === '/org/customer-site-works') return [{
        id: 12, name: 'Освоение скважины', startsAt: '2026-01-01', expectedEndAt: '2026-01-10', clusterNumber: 'CL-1',
        status: 'ACTIVE', hasOverlap: false, customer: { id: 3, name: 'Заказчик' }, mine: { id: 4, name: 'Месторождение', base: { id: 5, name: 'База' } },
        well: { id: 6, name: 'Скважина' }, supervisor: { id: 7, user: { fullName: 'Руководитель' } },
      }] as never;
      if (path === '/org/customer-site-works/12/executions') return [{
        id: 99, performedAt: '2026-01-05', workType: { name: 'Осмотр' }, status: { name: 'Завершена' },
        contract: { number: 'CON-99' }, addendum: null, description: 'Фактические работы', responsible: ['Иван Иванов'],
      }] as never;
      throw new Error(`Unexpected GET ${path}`);
    });
    render(<CustomerSiteWorksPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Журнал' }));

    expect(await screen.findByText('CON-99')).toBeTruthy();
    expect(screen.getByText('05.01.2026')).toBeTruthy();
    expect(screen.getByText('Иван Иванов')).toBeTruthy();
    expect(api.get).toHaveBeenCalledWith('/org/customer-site-works/12/executions');
  });
});
