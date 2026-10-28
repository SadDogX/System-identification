import { Icon } from '@app/shared/ui';
import { ProfileMenu } from '../profile/ProfileMenu';
import { NotificationBell } from '../notifications/NotificationBell';

interface TopbarProps {
  onOpenMenu: () => void;
}

export function Topbar({ onOpenMenu }: TopbarProps) {
  return (
    <header className="topbar">
      <button type="button" className="icon-btn lg menu-button" aria-label="Меню" onClick={onOpenMenu}>
        <Icon name="menu" />
      </button>
      <div className="grow" />
      <NotificationBell />
      <ProfileMenu />
    </header>
  );
}
