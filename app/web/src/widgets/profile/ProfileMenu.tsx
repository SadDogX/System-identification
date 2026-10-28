import { useState } from 'react';
import { Link, useRouter } from '../../core/router.tsx';
import { useAuth, useCurrentUser } from '../../core/auth.tsx';
import { ROLE_LABELS } from '../../core/utils.ts';
import { useClickOutside } from '@app/shared/ui';

function formatInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function ProfileMenu() {
  const user = useCurrentUser();
  const { logout } = useAuth();
  const { navigate } = useRouter();
  const [open, setOpen] = useState(false);
  const outsideClickRef = useClickOutside(open, () => setOpen(false));

  const openRoute = (to: string) => {
    setOpen(false);
    navigate(to);
  };

  return (
    <div className="anchor" ref={outsideClickRef}>
      <button type="button" className="avatar" aria-label="Меню профиля" onClick={() => setOpen((current) => !current)}>
        {formatInitials(user.fullName)}
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
            <button type="button" className="menu-item" onClick={() => openRoute('/user/profile')}>
              Профиль
            </button>
          )}
          <button type="button" className="menu-item" onClick={() => openRoute('/change-password')}>
            Сменить пароль
          </button>
          <Link to="/settings" className="menu-item" onClick={() => setOpen(false)}>
            Настройки интерфейса
          </Link>
          <button type="button" className="menu-item" onClick={() => logout().then(() => navigate('/login'))}>
            Выйти
          </button>
        </div>
      )}
    </div>
  );
}
