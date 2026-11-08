import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { UserFormDialog } from './UserFormDialog.tsx';
import { useCurrentUser } from '../../core/auth.tsx';
import { api } from '../../core/api.ts';

vi.mock('../../core/auth.tsx', () => ({ useCurrentUser: vi.fn() }));
vi.mock('../../core/api.ts', () => ({
  api: {
    get: vi.fn(),
    patch: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
  errorMessage: (error: unknown) => String(error),
}));

const adminUser = {
  id: 7,
  fullName: 'Test User',
  login: 'test.user',
  systemRoles: ['ADMIN'] as ('ADMIN' | 'MANAGER')[],
  positionId: 1,
  position: null,
  phone: null,
  email: null,
  photoMime: null,
  photoFile: null,
  isActive: true,
  mustChangePassword: false,
  uiSettings: {},
  createdAt: '2026-01-01T00:00:00.000Z',
};

const roleCatalog = [
  { code: 'ADMIN', name: 'Administrator', isActive: true },
  { code: 'MANAGER', name: 'Manager', isActive: true },
  { code: 'EMPLOYEE', name: 'Employee', isActive: true },
  { code: 'ARCHIVED_ROLE', name: 'Archived', isActive: false },
];

afterEach(() => cleanup());

describe('UserFormDialog system roles', () => {
  it('lists active system roles separately and saves changed grants through the existing endpoint', async () => {
    vi.mocked(useCurrentUser).mockReturnValue({ ...adminUser, id: 1, systemRoles: ['ADMIN'] } as ReturnType<typeof useCurrentUser>);
    vi.mocked(api.get).mockImplementation(async (path: string) => {
      if (path === '/admin/org/roles') return roleCatalog as never;
      if (path === '/admin/positions') return [{ id: 1, name: 'Administrator', systemRole: { id: 1, code: 'ADMIN', name: 'Administrator', description: '', isActive: true }, sortOrder: 0, isArchived: false, usersCount: 1 }] as never;
      if (path === '/admin/users/7') return { user: { ...adminUser, systemRoles: ['ADMIN', 'MANAGER'] as ('ADMIN' | 'MANAGER')[] } } as never;
      throw new Error(`Unexpected GET ${path}`);
    });
    vi.mocked(api.patch).mockResolvedValue({} as never);
    vi.mocked(api.put).mockResolvedValue({} as never);

    render(<UserFormDialog open mode="edit" user={adminUser} onClose={vi.fn()} />);

    await screen.findByRole('combobox');
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => expect(api.put).not.toHaveBeenCalled());
    expect(api.patch).toHaveBeenCalledWith('/admin/users/7', expect.objectContaining({ positionId: 1 }));
  });

  it('does not call the role API when system roles were not changed', async () => {
    vi.mocked(useCurrentUser).mockReturnValue({ ...adminUser, id: 1, systemRoles: ['ADMIN'] } as ReturnType<typeof useCurrentUser>);
    vi.mocked(api.get).mockImplementation(async (path: string) => {
      if (path === '/admin/org/roles') return roleCatalog as never;
      if (path === '/admin/positions') return [] as never;
      if (path === '/admin/users/7') return { user: adminUser } as never;
      throw new Error(`Unexpected GET ${path}`);
    });
    vi.mocked(api.patch).mockResolvedValue({} as never);

    render(<UserFormDialog open mode="edit" user={adminUser} onClose={vi.fn()} />);
    await screen.findByRole('combobox');
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => expect(api.patch).toHaveBeenCalled());
    expect(api.put).not.toHaveBeenCalled();
  });
});
