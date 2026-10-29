import type { ReactNode } from 'react';
import type { Role } from '@app/shared';
import { Protected, homePath, useAuth } from './core/auth.tsx';
import { Layout } from './Layout.tsx';
import { Redirect, matchPath, useRouter } from './core/router.tsx';
import { LoginPage } from './modules/auth/LoginPage.tsx';
import { ChangePasswordPage } from './modules/auth/ChangePasswordPage.tsx';
import { NotificationsPage } from './modules/notifications/NotificationsPage.tsx';
import { AdminDashboardPage } from './modules/dashboard/AdminDashboardPage.tsx';
import { UsersPage } from './modules/users/UsersPage.tsx';
import { UserDetailPage } from './modules/users/UserDetailPage.tsx';
import { AdminCredentialsPage } from './modules/credentials/AdminCredentialsPage.tsx';
import { CatalogPage } from './modules/catalog/CatalogPage.tsx';
import { MessagesPage } from './modules/messages/MessagesPage.tsx';
import { AuditLogPage } from './modules/audit/AuditLogPage.tsx';
import { OverviewPage } from './modules/overview/OverviewPage.tsx';
import { PositionsPage } from './modules/positions/PositionsPage.tsx';
import { UserDashboardPage } from './modules/dashboard/UserDashboardPage.tsx';
import { UserCredentialsPage } from './modules/credentials/UserCredentialsPage.tsx';
import { ProfilePage } from './modules/profile/ProfilePage.tsx';
import { RadarCardsPage } from './modules/radar/RadarCardsPage.tsx';
import { IfoPage } from './modules/ifo/IfoPage.tsx';
import { WorkSchedulePage } from './modules/schedule/WorkSchedulePage.tsx';
import { AnnualSchedulePage } from './modules/schedule/AnnualSchedulePage.tsx';
import { ShiftPartnersPage } from './modules/schedule/ShiftPartnersPage.tsx';
import { OrganizationPage } from './modules/organization/OrganizationPage.tsx';
import { WorkExecutionPage } from './modules/organization/WorkExecutionPage.tsx';
import { BaseCatalogPage } from './modules/organization/BaseCatalogPage.tsx';
import { ReferenceDataPage } from './modules/organization/ReferenceDataPage.tsx';
import { SettingsPage } from './modules/settings/SettingsPage.tsx';
import { ModulePlaceholderPage } from './modules/common/ModulePlaceholderPage.tsx';
import { PersonnelPage } from './modules/organization/PersonnelPage.tsx';
import { WorkAssignmentsPage } from './modules/organization/WorkAssignmentsPage.tsx';

interface Route {
  path: string;
  role?: Role;
  systemRoles?: string[];
  render: (params: Record<string, string>) => ReactNode;
}

const ROUTES: Route[] = [
  { path: '/admin/dashboard', role: 'ADMIN', systemRoles: ['MANAGER', 'COORDINATOR', 'SENIOR_MECHANIC'], render: () => <AdminDashboardPage /> },
  { path: '/admin/overview', role: 'ADMIN', systemRoles: ['MANAGER', 'COORDINATOR', 'SENIOR_MECHANIC'], render: () => <OverviewPage /> },
  { path: '/admin/dictionaries/employees', role: 'ADMIN', systemRoles: ['MANAGER'], render: () => <PersonnelPage key="create" mode="create" /> },
  { path: '/admin/org/personnel', role: 'ADMIN', systemRoles: ['MANAGER'], render: () => <PersonnelPage key="directory" mode="directory" /> },
  { path: '/admin/org/assignments', role: 'ADMIN', systemRoles: ['MANAGER'], render: () => <OrganizationPage key="assignments" view="assignments" /> },
  { path: '/admin/org/transfers', role: 'ADMIN', systemRoles: ['MANAGER'], render: () => <OrganizationPage key="transfers" view="transfers" /> },
  { path: '/admin/work-assignments', role: 'ADMIN', systemRoles: ['MANAGER', 'COORDINATOR'], render: () => <WorkAssignmentsPage /> },
  { path: '/admin/org/contracts', role: 'ADMIN', systemRoles: ['MANAGER'], render: () => <WorkExecutionPage /> },
  { path: '/admin/work-schedule', role: 'ADMIN', render: () => <AnnualSchedulePage /> },
  { path: '/admin/work-schedule/calendar', role: 'ADMIN', render: () => <WorkSchedulePage admin /> },
  { path: '/admin/work-schedule/shift-partners', role: 'ADMIN', render: () => <ShiftPartnersPage /> },
  { path: '/admin/radar-cards', role: 'ADMIN', render: () => <RadarCardsPage /> },
  { path: '/admin/ifo', role: 'ADMIN', render: () => <IfoPage /> },
  { path: '/admin/equipment', role: 'ADMIN', render: () => <ModulePlaceholderPage title="Оборудование" description="Учёт и контроль оборудования организации" icon="grid" /> },
  { path: '/admin/work-execution', role: 'ADMIN', systemRoles: ['MANAGER'], render: () => <WorkExecutionPage /> },
  { path: '/admin/organization', role: 'ADMIN', systemRoles: ['MANAGER', 'COORDINATOR', 'SENIOR_MECHANIC', 'MECHANIC', 'SHOP_FOREMAN'], render: () => <OrganizationPage key="structure" view="structure" /> },
  { path: '/admin/dictionaries/bases', role: 'ADMIN', render: () => <BaseCatalogPage /> },
  { path: '/admin/dictionaries/organization', role: 'ADMIN', render: () => <ReferenceDataPage /> },
  { path: '/admin/users/:id', role: 'ADMIN', render: (p) => <UserDetailPage key={p.id} id={Number(p.id)} /> },
  { path: '/admin/credentials', role: 'ADMIN', systemRoles: ['MANAGER', 'COORDINATOR', 'SENIOR_MECHANIC', 'MECHANIC', 'SHOP_FOREMAN'], render: () => <AdminCredentialsPage /> },
  { path: '/admin/catalog', role: 'ADMIN', render: () => <CatalogPage /> },
  { path: '/admin/positions', role: 'ADMIN', render: () => <PositionsPage /> },
  { path: '/admin/messages', role: 'ADMIN', render: () => <MessagesPage /> },
  { path: '/admin/notifications', role: 'ADMIN', render: () => <NotificationsPage /> },
  { path: '/admin/audit-log', role: 'ADMIN', render: () => <AuditLogPage /> },
  { path: '/user/work-schedule', role: 'USER', render: () => <WorkSchedulePage /> },
  { path: '/user/work-schedule/calendar', role: 'USER', render: () => <WorkSchedulePage /> },
  { path: '/user/radar-cards', role: 'USER', render: () => <RadarCardsPage /> },
  { path: '/user/ifo', role: 'USER', render: () => <IfoPage /> },
  { path: '/user/dashboard', role: 'USER', render: () => <UserDashboardPage /> },
  { path: '/user/organization', role: 'USER', render: () => <OrganizationPage /> },
  { path: '/user/work-execution', role: 'USER', render: () => <WorkExecutionPage /> },
  { path: '/user/work-assignments', role: 'USER', render: () => <WorkAssignmentsPage /> },
  { path: '/user/credentials', role: 'USER', render: () => <UserCredentialsPage /> },
  { path: '/user/notifications', role: 'USER', render: () => <NotificationsPage /> },
  { path: '/user/profile', role: 'USER', render: () => <ProfilePage /> },
  { path: '/settings', render: () => <SettingsPage /> },
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
        <Protected role={route.role} systemRoles={route.systemRoles}>
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
