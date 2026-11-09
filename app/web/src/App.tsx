import type { ReactNode } from 'react';
import type { SystemRoleCode } from '@app/shared';
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
import { PersonnelPage } from './modules/organization/PersonnelPage.tsx';
import { WorkAssignmentsPage } from './modules/organization/WorkAssignmentsPage.tsx';
import { CustomerSiteWorksPage } from './modules/organization/CustomerSiteWorksPage.tsx';
import { PlannedWorkSchedulePage } from './modules/organization/PlannedWorkSchedulePage.tsx';

interface Route {
  path: string;
  
  systemRoles?: SystemRoleCode[];
  render: (params: Record<string, string>) => ReactNode;
}

const ROUTES: Route[] = [
  { path: '/admin/dashboard', systemRoles: ['ADMIN', 'MANAGER', 'COORDINATOR', 'SENIOR_MECHANIC'] ,render: () => <AdminDashboardPage /> },
  { path: '/admin/overview', systemRoles: ['ADMIN', 'MANAGER', 'COORDINATOR', 'SENIOR_MECHANIC'] ,render: () => <OverviewPage /> },
  { path: '/admin/org/personnel', systemRoles: ['ADMIN', 'MANAGER'] ,render: () => <PersonnelPage /> },
  { path: '/admin/org/assignments', systemRoles: ['ADMIN', 'MANAGER'] ,render: () => <OrganizationPage key="assignments" view="assignments" /> },
  { path: '/admin/org/transfers', systemRoles: ['ADMIN', 'MANAGER'] ,render: () => <OrganizationPage key="transfers" view="transfers" /> },
  { path: '/admin/planned-work', systemRoles: ['ADMIN', 'MANAGER', 'COORDINATOR'] ,render: () => <PlannedWorkSchedulePage /> },
  { path: '/admin/customer-site-works', systemRoles: ['ADMIN', 'COORDINATOR', 'MANAGER'] ,render: () => <CustomerSiteWorksPage /> },
  { path: '/admin/org/contracts', systemRoles: ['ADMIN', 'MANAGER'] ,render: () => <WorkExecutionPage /> },
  { path: '/admin/work-schedule', systemRoles: ['ADMIN'],render: () => <AnnualSchedulePage /> },
  { path: '/admin/work-schedule/calendar', systemRoles: ['ADMIN', ] ,render: () => <WorkSchedulePage admin /> },
  { path: '/admin/team-work-schedule', systemRoles: ['ADMIN', 'MANAGER', 'COORDINATOR'] ,render: () => <AnnualSchedulePage team /> },
  { path: '/admin/team-work-schedule/calendar', systemRoles: ['ADMIN', 'MANAGER', 'COORDINATOR'] ,render: () => <WorkSchedulePage team /> },
  { path: '/admin/work-schedule/shift-partners', systemRoles: ['ADMIN', ] ,render: () => <ShiftPartnersPage /> },
  { path: '/admin/radar-cards', systemRoles: ['ADMIN', ] ,render: () => <RadarCardsPage /> },
  { path: '/admin/ifo', systemRoles: ['ADMIN', ] ,render: () => <IfoPage /> },
  { path: '/admin/work-execution', systemRoles: ['ADMIN', 'MANAGER'] ,render: () => <WorkExecutionPage /> },
  { path: '/admin/organization', systemRoles: ['ADMIN', 'MANAGER', 'COORDINATOR', 'SENIOR_MECHANIC', 'MECHANIC', 'SHOP_FOREMAN'] ,render: () => <OrganizationPage key="structure" view="structure" /> },
  { path: '/admin/dictionaries/bases', systemRoles: ['ADMIN', ] ,render: () => <BaseCatalogPage /> },
  { path: '/admin/dictionaries/organization', systemRoles: ['ADMIN', ] ,render: () => <ReferenceDataPage /> },
  { path: '/admin/users/:id', systemRoles: ['ADMIN', ] ,render: (p) => <UserDetailPage key={p.id} id={Number(p.id)} /> },
  { path: '/admin/credentials', systemRoles: ['ADMIN', 'MANAGER', 'COORDINATOR', 'SENIOR_MECHANIC', 'MECHANIC', 'SHOP_FOREMAN'] ,render: () => <AdminCredentialsPage /> },
  { path: '/admin/catalog', systemRoles: ['ADMIN', ] ,render: () => <CatalogPage /> },
  { path: '/admin/positions', systemRoles: ['ADMIN', ] ,render: () => <PositionsPage /> },
  { path: '/admin/messages', systemRoles: ['ADMIN', ] ,render: () => <MessagesPage /> },
  { path: '/admin/notifications', systemRoles: ['ADMIN', ] ,render: () => <NotificationsPage /> },
  { path: '/admin/audit-log', systemRoles: ['ADMIN', ] ,render: () => <AuditLogPage /> },
  { path: '/user/work-schedule', systemRoles: ['EMPLOYEE'], render: () => <WorkSchedulePage /> },
  { path: '/user/work-schedule/calendar', systemRoles: ['EMPLOYEE'], render: () => <WorkSchedulePage /> },
  { path: '/user/radar-cards', systemRoles: ['EMPLOYEE'], render: () => <RadarCardsPage /> },
  { path: '/user/ifo', systemRoles: ['EMPLOYEE'], render: () => <IfoPage /> },
  { path: '/user/dashboard', systemRoles: ['EMPLOYEE'], render: () => <UserDashboardPage /> },
  { path: '/user/organization', systemRoles: ['EMPLOYEE'], render: () => <OrganizationPage /> },
  { path: '/user/work-execution', systemRoles: ['EMPLOYEE'], render: () => <WorkExecutionPage /> },
  { path: '/user/planned-work', systemRoles: ['EMPLOYEE'], render: () => <PlannedWorkSchedulePage /> },
  { path: '/user/credentials', systemRoles: ['EMPLOYEE'], render: () => <UserCredentialsPage /> },
  { path: '/user/notifications', systemRoles: ['EMPLOYEE'], render: () => <NotificationsPage /> },
  { path: '/user/profile', systemRoles: ['EMPLOYEE'], render: () => <ProfilePage /> },
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
        <Protected systemRoles={route.systemRoles}>
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
