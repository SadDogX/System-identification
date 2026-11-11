import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { WorkExecutionPage } from './WorkExecutionPage.tsx';
import { useCurrentUser } from '../../core/auth.tsx';
import { api } from '../../core/api.ts';

vi.mock('../../core/auth.tsx', () => ({ useCurrentUser: vi.fn() }));
vi.mock('../../core/api.ts', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn(), upload: vi.fn(), blob: vi.fn() },
  errorMessage: (error: unknown) => String(error),
}));

const activeStatus = { id: 2, code: 'ACTIVE', name: 'Действует', isActive: true, allowsWork: true };
const contract = {
  id: 11,
  number: 'CON-1',
  startsAt: '2026-01-01T00:00:00.000Z',
  endsAt: '2026-12-31T00:00:00.000Z',
  customer: { id: 4, name: 'Общий заказчик', code: null, isActive: true },
  status: activeStatus,
  addenda: [],
};

function setup() {
  vi.mocked(useCurrentUser).mockReturnValue({
    id: 7, fullName: 'Test Admin', login: 'test.admin', systemRoles: ['ADMIN'], positionId: null, position: null,
    phone: null, email: null, photoMime: null, photoFile: null, isActive: true, mustChangePassword: false,
    uiSettings: {}, createdAt: '2026-01-01T00:00:00.000Z',
  });
  vi.mocked(api.get).mockImplementation(async (path: string) => {
    if (path === '/org/users/7/employee') return { user: { systemRoles: [] } } as never;
    if (path === '/org/bases') return [{ id: 1, name: 'База', code: null }] as never;
    if (path === '/org/mines') return [{ id: 20, name: 'Месторождение', baseId: 1, base: { id: 1, name: 'База' } }] as never;
    if (path === '/org/customers') return [{ id: 4, name: 'Общий заказчик', code: null, isActive: true }] as never;
    if (path === '/org/work-types') return [{ id: 31, name: 'Осмотр скважины', code: 'INSPECTION', requiresContractPermission: true }] as never;
    if (path === '/org/statuses/work') return [{ id: 42, code: 'COMPLETED', name: 'Завершена', isActive: true }] as never;
    if (path === '/org/statuses/contract') return [activeStatus, { id: 3, code: 'CLOSED', name: 'Закрыт', isActive: true, allowsWork: false }] as never;
    if (path === '/org/statuses/addendum') return [] as never;
    if (path === '/org/bases/1/contracts') return [contract] as never;
    if (path === '/org/contracts/11/documents') return [] as never;
    if (path === '/org/mines/20/wells') return [{ id: 21, name: 'Скважина 1', code: 'W-1' }] as never;
    if (path === '/org/wells/21/customer-site-works') return [{
      id: 55, name: 'Освоение скважины', customer: { id: 4, name: 'Общий заказчик' }, startsAt: '2026-01-01', expectedEndAt: '2026-01-10',
    }] as never;
    throw new Error(`Unexpected GET ${path}`);
  });
  vi.mocked(api.post).mockResolvedValue({} as never);
  vi.mocked(api.patch).mockResolvedValue({} as never);
  vi.mocked(api.upload).mockResolvedValue({} as never);
  render(<WorkExecutionPage />);
}

afterEach(() => cleanup());

describe('WorkExecutionPage contract lifecycle', () => {
  it('associates a recorded execution with a customer site work', async () => {
    setup();

    fireEvent.change(await screen.findByLabelText('Месторождение'), { target: { value: '20' } });
    const wellSelects = await screen.findAllByLabelText('Скважина');
    fireEvent.change(wellSelects[1], { target: { value: '21' } });
    await screen.findByRole('option', { name: /Освоение скважины · Общий заказчик/ });
    fireEvent.change(screen.getByLabelText('Работа на объекте заказчика'), { target: { value: '55' } });
    fireEvent.change(screen.getByLabelText('Вид работ'), { target: { value: '31' } });
    fireEvent.click(screen.getByRole('button', { name: 'Зарегистрировать работу' }));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/org/work', expect.objectContaining({
      wellId: 21,
      customerSiteWorkId: 55,
      workTypeId: 31,
      statusId: 42,
    })));
  });

  it('offers contract editing and documents without duplicating customer creation', async () => {
    setup();

    await screen.findByRole('option', { name: 'База' });
    fireEvent.change(screen.getByLabelText('База'), { target: { value: '1' } });
    await screen.findByRole('option', { name: 'CON-1 · Общий заказчик (Действует)' });
    fireEvent.change(screen.getByLabelText('Договор'), { target: { value: '11' } });

    const status = await screen.findByLabelText('Статус договора') as HTMLSelectElement;
    fireEvent.change(status, { target: { value: '3' } });
    fireEvent.change(screen.getAllByLabelText('Номер договора')[1], { target: { value: 'CON-1-A' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить договор' }));

    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/org/contracts/11', expect.objectContaining({
      customerId: 4,
      statusId: 3,
      number: 'CON-1-A',
      startsAt: '2026-01-01',
      endsAt: '2026-12-31',
    })));
    expect(screen.queryByText('Новый заказчик')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Добавить заказчика' })).toBeNull();
    expect(screen.getByText('Документы договора')).toBeTruthy();

    const file = new File(['%PDF-1.4'], 'договор.pdf', { type: 'application/pdf' });
    const input = document.querySelector('input[type="file"]');
    expect(input).toBeTruthy();
    fireEvent.change(input as HTMLInputElement, { target: { files: [file] } });
    await waitFor(() => expect(api.upload).toHaveBeenCalledWith('/org/contracts/11/documents', file));
  });
});
