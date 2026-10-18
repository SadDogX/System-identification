import { useState, type ReactNode } from 'react';
import { useAuth, useCurrentUser } from './core/auth.tsx';
import { Link, useRouter } from './core/router.tsx';
import { ROLE_LABELS } from './core/utils.ts';
import { Icon, type IconName, useClickOutside } from '@app/shared/ui';
import { NotificationBell } from './modules/notifications/NotificationBell.tsx';

const ADMIN_NAV: { to: string; label: string; icon: IconName }[] = [
  { to: '/admin/dashboard', label: 'Дашборд', icon: 'dashboard' },
  { to: '/admin/overview', label: 'Общие сведения', icon: 'overview' },
  { to: '/admin/users', label: 'Пользователи', icon: 'people' },
  { to: '/admin/credentials', label: 'Удостоверения', icon: 'badge' },
  { to: '/admin/catalog', label: 'Справочник удостоверений', icon: 'book' },
  { to: '/admin/positions', label: 'Справочник должностей', icon: 'work' },
  { to: '/admin/notifications', label: 'Уведомления', icon: 'bell' },
  { to: '/admin/messages', label: 'Сообщения', icon: 'send' },
  { to: '/admin/audit-log', label: 'Журнал действий', icon: 'history' },
];

const USER_NAV: typeof ADMIN_NAV = [
  { to: '/user/dashboard', label: 'Главная', icon: 'dashboard' },
  { to: '/user/credentials', label: 'Мои удостоверения', icon: 'badge' },
  { to: '/user/notifications', label: 'Уведомления', icon: 'bell' },
  { to: '/user/profile', label: 'Профиль', icon: 'person' },
];

function initials(fullName: string) {
  return fullName
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

function ProfileMenu() {
  const user = useCurrentUser();
  const { logout } = useAuth();
  const { navigate } = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useClickOutside(open, () => setOpen(false));

  const go = (to: string) => {
    setOpen(false);
    navigate(to);
  };

  return (
    <div className="anchor" ref={ref}>
      <button type="button" className="avatar" aria-label="Меню профиля" onClick={() => setOpen((v) => !v)}>
        {initials(user.fullName)}
      </button>
      {open && (
        <div className="popover" style={{ width: 260 }}>
          <div className="popover-head" style={{ display: 'block' }}>
            <div className="bold">{user.fullName}</div>
            <div className="muted small">
              {ROLE_LABELS[user.role]} · {user.login}
            </div>
          </div>
          {user.role === 'USER' && (
            <button type="button" className="menu-item" onClick={() => go('/user/profile')}>
              Профиль
            </button>
          )}
          <button type="button" className="menu-item" onClick={() => go('/change-password')}>
            Сменить пароль
          </button>
          <button type="button" className="menu-item" onClick={() => logout().then(() => navigate('/login'))}>
            Выйти
          </button>
        </div>
      )}
    </div>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const user = useCurrentUser();
  const { path } = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const nav = user.role === 'ADMIN' ? ADMIN_NAV : USER_NAV;

  return (
    <div className="shell">
      <aside className={`sidebar${menuOpen ? ' open' : ''}`}>
        <div className="brand">
          <Icon name="badge" />
          Учёт удостоверений
        </div>
        <nav className="nav">
          {nav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`nav-link${path.startsWith(item.to) ? ' active' : ''}`}
              onClick={() => setMenuOpen(false)}
            >
              <Icon name={item.icon} />
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className={`scrim${menuOpen ? ' open' : ''}`} onClick={() => setMenuOpen(false)} />

      <div className="main">
        <header className="topbar">
          <button type="button" className="icon-btn lg menu-button" aria-label="Меню" onClick={() => setMenuOpen(true)}>
            <Icon name="menu" />
          </button>
          <div className="grow" />
          <NotificationBell />
          <ProfileMenu />
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
