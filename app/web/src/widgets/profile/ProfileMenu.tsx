import { useState } from 'react';
import type { Language } from '@app/shared';
import { Link, useRouter } from '../../core/router.tsx';
import { useAuth, useCurrentUser } from '../../core/auth.tsx';
import { useLanguage } from '../../core/i18n.tsx';
import { useClickOutside } from '@app/shared/ui';

function formatInitials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('');
}

export function ProfileMenu() {
  const user = useCurrentUser();
  const { logout } = useAuth();
  const { navigate } = useRouter();
  const { language, setLanguage, t } = useLanguage();
  const [open, setOpen] = useState(false);
  const outsideClickRef = useClickOutside(open, () => setOpen(false));
  const openRoute = (to: string) => { setOpen(false); navigate(to); };
  const changeLanguage = async (next: Language) => {
    try { await setLanguage(next); } catch { /* local choice remains effective if server write fails */ }
  };

  return (
    <div className="anchor" ref={outsideClickRef}>
      <button type="button" className="avatar" aria-label={t('profileMenu')} onClick={() => setOpen((current) => !current)}>
        {formatInitials(user.fullName)}
      </button>
      {open && <div className="popover" style={{ width: 260 }}>
        <div className="popover-head" style={{ display: 'block' }}>
          <div className="bold">{user.fullName}</div>
          <div className="muted small">
            {t(`roles.${user.systemRoles[0] ?? 'EMPLOYEE'}`)} · {user.login}<br />
            <b>{user.position}</b>
          </div>
        </div>
        <label className="menu-item" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span>{t('language')}</span>
          <select aria-label={t('language')} value={language} onChange={(event) => void changeLanguage(event.target.value as Language)}>
            <option value="ru">{t('russian')}</option>
            <option value="en">{t('english')}</option>
          </select>
        </label>
        {!user.systemRoles.includes('ADMIN') && <button type="button" className="menu-item" onClick={() => openRoute('/user/profile')}>{t('profile')}</button>}
        <button type="button" className="menu-item" onClick={() => openRoute('/change-password')}>{t('changePassword')}</button>
        <Link to="/settings" className="menu-item" onClick={() => setOpen(false)}>{t('interfaceSettings')}</Link>
        <button type="button" className="menu-item" onClick={() => logout().then(() => navigate('/login'))}>{t('signOut')}</button>
      </div>}
    </div>
  );
}
