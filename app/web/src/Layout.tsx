import { useEffect, useState, type ReactNode } from 'react';
import { useAuth, useCurrentUser } from './core/auth.tsx';
import { Link, useRouter } from './core/router.tsx';
import { ROLE_LABELS } from './core/utils.ts';
import { Icon, type IconName, useClickOutside } from '@app/shared/ui';
import { NotificationBell } from './modules/notifications/NotificationBell.tsx';

interface NavItem { to: string; label: string; icon: IconName }
interface NavSubgroup { label: string; icon: IconName; items: NavItem[] }
interface NavGroup { label: string; icon: IconName; items?: NavItem[]; subgroups?: NavSubgroup[] }

const USER_ITEMS: NavItem[] = [
  { to: '/user/dashboard', label: 'Панель управления', icon: 'dashboard' },
  { to: '/user/organization', label: 'Моя база и команда', icon: 'people' },
  { to: '/user/work-execution', label: 'Договоры и работы', icon: 'doneAll' },
  { to: '/user/credentials', label: 'Удостоверения', icon: 'badge' },
];
const ADMIN_PEOPLE_ITEMS: NavItem[] = [
  { to: '/admin/dashboard', label: 'Панель управления', icon: 'dashboard' },
  { to: '/admin/overview', label: 'Список удостоверений', icon: 'overview' },
  { to: '/admin/credentials', label: 'Записи удостоверений', icon: 'badge' },
];
const WPTS_ITEMS: NavItem[] = [
  { to: '/admin/radar-cards', label: 'Радар карты', icon: 'warning' },
  { to: '/admin/ifo', label: 'IFO', icon: 'overview' },
];
const USER_WPTS_ITEMS: NavItem[] = [
  { to: '/user/radar-cards', label: 'Радар карты', icon: 'warning' },
  { to: '/user/ifo', label: 'IFO', icon: 'overview' },
];
const ROOT_ADMIN_ITEMS: NavItem[] = [
  { to: '/admin/notifications', label: 'Уведомления', icon: 'bell' },
  { to: '/admin/messages', label: 'Сообщения', icon: 'send' },
  { to: '/admin/audit-log', label: 'Аудит и логи', icon: 'history' },
  { to: '/settings', label: 'Настройки интерфейса', icon: 'settings' },
];
const ROOT_USER_ITEMS: NavItem[] = [
  { to: '/user/notifications', label: 'Уведомления', icon: 'bell' },
  { to: '/user/profile', label: 'Профиль', icon: 'person' },
  { to: '/settings', label: 'Настройки интерфейса', icon: 'settings' },
];
const SCHEDULE_ADMIN_ITEMS: NavItem[] = [
  { to: '/admin/work-schedule', label: 'Таблица', icon: 'table' },
  { to: '/admin/work-schedule/calendar', label: 'Редактирование', icon: 'overview' },
  { to: '/admin/work-schedule/shift-partners', label: 'Генерация сменщиков', icon: 'people' },
];
const SCHEDULE_USER_ITEMS: NavItem[] = [
  { to: '/user/work-schedule', label: 'Таблица', icon: 'table' },
  { to: '/user/work-schedule/calendar', label: 'Мой график', icon: 'overview' },
];




const ADMIN_NAV_GROUPS: NavGroup[] = [
  {
    label: 'Сотрудники', icon: 'people', subgroups: [
      { label: 'Учёт удостоверений', icon: 'badge', items: ADMIN_PEOPLE_ITEMS },
      { label: 'WPTS', icon: 'grid', items: WPTS_ITEMS },
      { label: 'Учёт графиков', icon: 'table', items: SCHEDULE_ADMIN_ITEMS },
    ]
  },
  { label: 'Оборудование', icon: 'grid', items: [{ to: '/admin/equipment', label: 'Оборудование', icon: 'grid' }] },
  { label: 'Организация БПО', icon: 'people', items: [{ to: '/admin/org/personnel', label: 'Персонал', icon: 'people' }, { to: '/admin/dictionaries/employees', label: 'Добавить сотрудника', icon: 'add' }, { to: '/admin/org/assignments', label: 'Назначения', icon: 'doneAll' }, { to: '/admin/org/transfers', label: 'Переводы', icon: 'history' }, { to: '/admin/org/contracts', label: 'Договоры', icon: 'book' }, { to: '/admin/organization', label: 'Месторождения и скважины', icon: 'grid' }] },
  { label: 'Справочники', icon: 'book', items: [{ to: '/admin/dictionaries/bases', label: 'Базы', icon: 'grid' }, { to: '/admin/dictionaries/organization', label: 'Статусы и виды работ', icon: 'book' }, { to: '/admin/positions', label: 'Должности', icon: 'work' }, { to: '/admin/catalog', label: 'Удостоверения', icon: 'badge' }] },
  { label: 'Общие разделы', icon: 'grid', items: ROOT_ADMIN_ITEMS },
];
const USER_NAV_GROUPS: NavGroup[] = [{
  label: 'Сотрудники', icon: 'people', subgroups: [
    { label: 'Учёт удостоверений', icon: 'badge', items: USER_ITEMS },
    { label: 'WPTS', icon: 'grid', items: USER_WPTS_ITEMS },
    { label: 'Учёт графиков', icon: 'table', items: SCHEDULE_USER_ITEMS },
  ]
}, { label: 'Общие разделы', icon: 'grid', items: ROOT_USER_ITEMS }];
const LEAD_NAV_GROUPS: NavGroup[] = [
  ...USER_NAV_GROUPS,
  { label: 'Моя команда', icon: 'people', items: [
    { to: '/admin/dashboard', label: 'Сводка команды', icon: 'dashboard' },
    { to: '/admin/overview', label: 'Удостоверения команды', icon: 'overview' },
    { to: '/admin/credentials', label: 'Записи удостоверений', icon: 'badge' },
  ] },
];
const CREDENTIAL_LEAD_NAV_GROUPS: NavGroup[] = [
  ...USER_NAV_GROUPS,
  { label: 'Моя команда', icon: 'people', items: [{ to: '/admin/credentials', label: 'Записи удостоверений', icon: 'badge' }] },
];

function groupHasActivePath(group: NavGroup, path: string) {
  return [...(group.items ?? []), ...(group.subgroups ?? []).flatMap((s) => s.items)].some((item) => path.startsWith(item.to));
}
function subgroupHasActivePath(group: NavSubgroup, path: string) {
  return group.items.some((item) => path.startsWith(item.to));
}
function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('');
}

function ProfileMenu() {
  const user = useCurrentUser();
  const { logout } = useAuth();
  const { navigate } = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useClickOutside(open, () => setOpen(false));
  const go = (to: string) => { setOpen(false); navigate(to); };
  return <div className="anchor" ref={ref}>
    <button type="button" className="avatar" aria-label="Меню профиля" onClick={() => setOpen((v) => !v)}>{initials(user.fullName)}</button>{open &&
      <div className="popover" style={{ width: 260 }}>
        <div className="popover-head" style={{ display: 'block' }}>
          <div className="bold">{user.fullName}</div>
          <div className="muted small">{ROLE_LABELS[user.role]} · {user.login}</div>
        </div>{user.role === 'USER' &&
          <button type="button" className="menu-item" onClick={() => go('/user/profile')}>Профиль</button>}
        <button type="button" className="menu-item" onClick={() => go('/change-password')}>Сменить пароль</button>
        <button type="button" className="menu-item" onClick={() => go('/settings')}>Настройки интерфейса</button>
        <button type="button" className="menu-item" onClick={() => logout().then(() => navigate('/login'))}>Выйти</button>
      </div>}
  </div>;
}

export function Layout({ children }: { children: ReactNode }) {
  const user = useCurrentUser(); const { path } = useRouter(); const [menuOpen, setMenuOpen] = useState(false); const isLead = user.systemRoles.some((role) => ['MANAGER', 'COORDINATOR', 'SENIOR_MECHANIC'].includes(role)); const isCredentialLead = user.systemRoles.some((role) => ['MECHANIC', 'SHOP_FOREMAN'].includes(role)); const navGroups = user.role === 'ADMIN' ? ADMIN_NAV_GROUPS : isLead ? LEAD_NAV_GROUPS : isCredentialLead ? CREDENTIAL_LEAD_NAV_GROUPS : USER_NAV_GROUPS;
  const activeGroupIndex = navGroups.findIndex((group) => groupHasActivePath(group, path));
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({ Сотрудники: true });
  const [expandedSubgroups, setExpandedSubgroups] = useState<Record<string, boolean>>({ 'Учёт удостоверений': true, WPTS: true });
  useEffect(() => {
    document.documentElement.dataset.theme = user.uiSettings.theme ?? 'slate';
  }, [user.uiSettings.theme]);
  useEffect(() => {
    if (activeGroupIndex >= 0) {
      const group = navGroups[activeGroupIndex];
      setExpandedGroups((v) => ({ ...v, [group.label]: true }));
      for (const sub of group.subgroups ?? [])
        if (subgroupHasActivePath(sub, path)) setExpandedSubgroups((v) => ({ ...v, [sub.label]: true }));
    }
  }, [activeGroupIndex, navGroups, path]);
  const toggle = (set: React.Dispatch<React.SetStateAction<Record<string, boolean>>>, label: string) => set((v) => ({ ...v, [label]: !v[label] }));
  return <div className="shell">
    <aside className={`sidebar${menuOpen ? ' open' : ''}`}>
      <div className="brand">
        <Icon name="badge" />Учёт удостоверений</div>
      <div className="sidebar-settings"><Link to="/settings" className={`nav-link${path === '/settings' ? ' active' : ''}`} onClick={() => setMenuOpen(false)}><Icon name="settings" />Настройки</Link></div>
      <nav className="nav">{navGroups.map((group) => {
        const expanded = expandedGroups[group.label] ?? false;
        const active = groupHasActivePath(group, path);
        return <div className={`nav-group${expanded ? ' expanded' : ''}`}
          key={group.label}>
          <button type="button"
            className={`nav-group-title${active ? ' active' : ''}`}
            onClick={() => toggle(setExpandedGroups, group.label)}
            aria-expanded={expanded}>
            <Icon name={group.icon} small />
            <span>{group.label}</span>
            <span className="nav-group-chevron">{expanded ? '−' : '+'}</span>
          </button>
          {expanded && <div className="nav-group-items">{(group.items ?? []).map((item) =>
            <Link
              key={item.to}
              to={item.to}
              className={`nav-link${path.startsWith(item.to) ? ' active' : ''}`}
              onClick={() => setMenuOpen(false)}>
              <Icon name={item.icon} />{item.label}
            </Link>)}
            {(group.subgroups ?? []).map((sub) => {
              const subExpanded = expandedSubgroups[sub.label] ?? false;
              const subActive = subgroupHasActivePath(sub, path);
              return <div className="nav-subgroup" key={sub.label}>
                <button type="button"
                  className={`nav-subgroup-title${subActive ? ' active' : ''}`}
                  onClick={() => toggle(setExpandedSubgroups, sub.label)}
                  aria-expanded={subExpanded}>
                  <Icon name={sub.icon} small />
                  <span>{sub.label}</span>
                  <span className="nav-group-chevron">{subExpanded ? '−' : '+'}</span>
                </button>{subExpanded && <div className="nav-subgroup-items">{sub.items.map((item) =>
                  <Link key={item.to} to={item.to} className={`nav-link${path.startsWith(item.to) ? ' active' : ''}`} onClick={() => setMenuOpen(false)}>
                    <Icon name={item.icon} />{item.label}</Link>)}
                </div>}
              </div>;
            })}</div>}
        </div>;
      })}
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
  </div>;
}
