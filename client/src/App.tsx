import type { ReactNode } from 'react';
import type { Role } from '@app/shared';
import { Protected, homePath, useAuth } from './auth.tsx';
import { Layout } from './components/Layout.tsx';
import { Redirect, matchPath, useRouter } from './router.tsx';
import { LoginPage } from './pages/LoginPage.tsx';
import { ChangePasswordPage } from './pages/ChangePasswordPage.tsx';
import { NotificationsPage } from './pages/NotificationsPage.tsx';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage.tsx';
import { UsersPage } from './pages/admin/UsersPage.tsx';
import { UserDetailPage } from './pages/admin/UserDetailPage.tsx';
import { AdminCredentialsPage } from './pages/admin/AdminCredentialsPage.tsx';
import { CatalogPage } from './pages/admin/CatalogPage.tsx';
import { MessagesPage } from './pages/admin/MessagesPage.tsx';
import { AuditLogPage } from './pages/admin/AuditLogPage.tsx';
import { OverviewPage } from './pages/admin/OverviewPage.tsx';
import { PositionsPage } from './pages/admin/PositionsPage.tsx';
import { UserDashboardPage } from './pages/user/UserDashboardPage.tsx';
import { UserCredentialsPage } from './pages/user/UserCredentialsPage.tsx';
import { ProfilePage } from './pages/user/ProfilePage.tsx';

interface Route {
  path: string;
  role: Role;
  render: (params: Record<string, string>) => ReactNode;
}

const ROUTES: Route[] = [
  { path: '/admin/dashboard', role: 'ADMIN', render: () => <AdminDashboardPage /> },
  { path: '/admin/overview', role: 'ADMIN', render: () => <OverviewPage /> },
  { path: '/admin/users', role: 'ADMIN', render: () => <UsersPage /> },
  { path: '/admin/users/:id', role: 'ADMIN', render: (p) => <UserDetailPage key={p.id} id={Number(p.id)} /> },
  { path: '/admin/credentials', role: 'ADMIN', render: () => <AdminCredentialsPage /> },
  { path: '/admin/catalog', role: 'ADMIN', render: () => <CatalogPage /> },
  { path: '/admin/positions', role: 'ADMIN', render: () => <PositionsPage /> },
  { path: '/admin/messages', role: 'ADMIN', render: () => <MessagesPage /> },
  { path: '/admin/notifications', role: 'ADMIN', render: () => <NotificationsPage /> },
  { path: '/admin/audit-log', role: 'ADMIN', render: () => <AuditLogPage /> },
  { path: '/user/dashboard', role: 'USER', render: () => <UserDashboardPage /> },
  { path: '/user/credentials', role: 'USER', render: () => <UserCredentialsPage /> },
  { path: '/user/notifications', role: 'USER', render: () => <NotificationsPage /> },
  { path: '/user/profile', role: 'USER', render: () => <ProfilePage /> },
];

function Home() {
  const { user } = useAuth();
  return <Redirect to={user ? homePath(user) : '/login'} />;
}

export function App() {
  const { path } = useRouter();

  if (path === '/login') return <LoginPage />;
  if (path === '/change-password') {
    return (
      <Protected>
        <ChangePasswordPage />
      </Protected>
    );
  }

  for (const route of ROUTES) {
    const params = matchPath(route.path, path);
    if (params) {
      return (
        <Protected role={route.role}>
          <Layout>{route.render(params)}</Layout>
        </Protected>
      );
    }
  }

  // Любой другой адрес — на главную своей роли
  return (
    <Protected>
      <Home />
    </Protected>
  );
}
