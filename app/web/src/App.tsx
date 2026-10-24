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
import { ModulePlaceholderPage } from './modules/common/ModulePlaceholderPage.tsx';
import { RadarCardsPage } from './modules/radar/RadarCardsPage.tsx';
import { IfoPage } from './modules/ifo/IfoPage.tsx';
import { WorkSchedulePage } from './modules/schedule/WorkSchedulePage.tsx';
import { AnnualSchedulePage } from './modules/schedule/AnnualSchedulePage.tsx';
import { ScheduleOverviewPage } from './modules/schedule/ScheduleOverviewPage.tsx';
import { ShiftPartnersPage } from './modules/schedule/ShiftPartnersPage.tsx';

interface Route {
  path: string;
  role: Role;
  render: (params: Record<string, string>) => ReactNode;
}

const ROUTES: Route[] = [
  { path: '/admin/dashboard', role: 'ADMIN', render: () => <AdminDashboardPage /> },
  { path: '/admin/overview', role: 'ADMIN', render: () => <OverviewPage /> },
  { path: '/admin/employees', role: 'ADMIN', render: () => <UsersPage /> },
  { path: '/admin/work-schedule', role: 'ADMIN', render: () => <AnnualSchedulePage /> },
  { path: '/admin/work-schedule/calendar', role: 'ADMIN', render: () => <WorkSchedulePage admin /> },
  { path: '/admin/work-schedule/shift-partners', role: 'ADMIN', render: () => <ShiftPartnersPage /> },
  { path: '/admin/schedule-assignments', role: 'ADMIN', render: () => <ModulePlaceholderPage title="Назначения на базы и объекты" description="Назначения сотрудников на базы и рабочие объекты" icon="grid" /> },
  { path: '/admin/schedule-events', role: 'ADMIN', render: () => <ModulePlaceholderPage title="Фактические события" description="Регистрация прибытий и выездов" icon="doneAll" /> },
  { path: '/admin/schedule-absences', role: 'ADMIN', render: () => <ModulePlaceholderPage title="Отсутствия" description="Отпуска, больничные и другие отсутствия" icon="warning" /> },
  { path: '/admin/schedule-approvals', role: 'ADMIN', render: () => <ModulePlaceholderPage title="Согласования" description="Критические изменения графика" icon="check" /> },
  { path: '/admin/schedule-bulk-operations', role: 'ADMIN', render: () => <ModulePlaceholderPage title="Массовые операции" description="Массовое планирование и контроль результатов" icon="people" /> },
  { path: '/admin/schedule-integrations', role: 'ADMIN', render: () => <ModulePlaceholderPage title="Интеграционные задачи" description="Расхождения и ручной разбор интеграции" icon="history" /> },
  { path: '/admin/radar-cards', role: 'ADMIN', render: () => <RadarCardsPage /> },
  { path: '/admin/ifo', role: 'ADMIN', render: () => <IfoPage /> },
  { path: '/admin/equipment', role: 'ADMIN', render: () => <ModulePlaceholderPage title="Оборудование" description="Учёт и контроль оборудования организации" icon="grid" /> },
  { path: '/admin/work-execution', role: 'ADMIN', render: () => <ModulePlaceholderPage title="Выполнение работ" description="Планирование и контроль выполнения работ" icon="doneAll" /> },

  { path: '/admin/users/:id', role: 'ADMIN', render: (p) => <UserDetailPage key={p.id} id={Number(p.id)} /> },
  { path: '/admin/credentials', role: 'ADMIN', render: () => <AdminCredentialsPage /> },
  { path: '/admin/catalog', role: 'ADMIN', render: () => <CatalogPage /> },
  { path: '/admin/positions', role: 'ADMIN', render: () => <PositionsPage /> },
  { path: '/admin/messages', role: 'ADMIN', render: () => <MessagesPage /> },
  { path: '/admin/notifications', role: 'ADMIN', render: () => <NotificationsPage /> },
  { path: '/admin/audit-log', role: 'ADMIN', render: () => <AuditLogPage /> },
  { path: '/user/work-schedule', role: 'USER', render: () => <ScheduleOverviewPage /> },
  { path: '/user/work-schedule/calendar', role: 'USER', render: () => <WorkSchedulePage /> },
  { path: '/user/schedule-events', role: 'USER', render: () => <ModulePlaceholderPage title="Фактические события" description="Регистрация прибытий и выездов" icon="doneAll" /> },
  { path: '/user/schedule-history', role: 'USER', render: () => <ModulePlaceholderPage title="История графика" description="История плановых периодов и событий" icon="history" /> },
  { path: '/user/radar-cards', role: 'USER', render: () => <RadarCardsPage /> },
  { path: '/user/ifo', role: 'USER', render: () => <IfoPage /> },
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
