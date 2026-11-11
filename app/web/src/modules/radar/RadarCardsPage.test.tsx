import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RadarCardsPage } from './RadarCardsPage.tsx';
import { useCurrentUser } from '../../core/auth.tsx';
import { api } from '../../core/api.ts';

vi.mock('../../core/auth.tsx', () => ({ useCurrentUser: vi.fn() }));
vi.mock('../../widgets/display', () => ({ ViewToggle: () => null }));
vi.mock('../../core/api.ts', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  errorMessage: (error: unknown) => String(error),
}));

const card = {
  id: 21,
  userId: 7,
  customerId: null,
  customerName: 'Старое название',
  customer: null,
  mainInfo: 'Информация',
  event: 'Событие',
  actionsTaken: 'Действия',
  incidentDate: '2026-01-02',
  requiredActions: null,
  stoppedWork: false,
  createdAt: '2026-01-02T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
  user: { id: 7, fullName: 'Сотрудник', login: 'employee' },
};

function setup(items: typeof card[] = []) {
  vi.mocked(useCurrentUser).mockReturnValue({
    id: 7, fullName: 'Test User', login: 'test.user', systemRoles: [], positionId: null, position: null,
    phone: null, email: null, photoMime: null, photoFile: null, isActive: true, mustChangePassword: false,
    uiSettings: {}, createdAt: '2026-01-01T00:00:00.000Z',
  });
  vi.mocked(api.get).mockImplementation(async (path: string) => {
    if (path === '/radar-cards') return { items, total: items.length, page: 1, pageSize: 20 } as never;
    if (path === '/radar-cards/users') return [] as never;
    if (path === '/radar-cards/customers') return [{ id: 3, name: 'Заказчик из справочника' }] as never;
    throw new Error(`Unexpected GET ${path}`);
  });
  vi.mocked(api.patch).mockResolvedValue({} as never);
  render(<RadarCardsPage />);
}

afterEach(() => cleanup());

describe('RadarCardsPage customer directory', () => {
  it('uses shared customer options for new cards', async () => {
    setup();

    fireEvent.click(screen.getByRole('button', { name: 'Создать карту' }));

    const customer = await screen.findByLabelText('Заказчик *') as HTMLSelectElement;
    expect(await screen.findByRole('option', { name: 'Заказчик из справочника' })).toBeTruthy();
    expect(customer.value).toBe('');
    expect(screen.queryByRole('option', { name: 'ООО «Стройинвест»' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Сохранить' }).hasAttribute('disabled')).toBe(true);
  });

  it('keeps an unmatched historical customer name visible and intact while it is linked', async () => {
    setup([card]);

    fireEvent.click(await screen.findByRole('button', { name: 'Просмотр/изменить' }));

    const customer = await screen.findByLabelText('Заказчик *') as HTMLSelectElement;
    expect(customer.value).toBe('');
    expect(screen.getByRole('option', { name: 'Не сопоставлен — Старое название' })).toBeTruthy();
    fireEvent.change(customer, { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/radar-cards/21', expect.objectContaining({
      customerId: 3,
      customerName: 'Старое название',
    })));
  });
});
