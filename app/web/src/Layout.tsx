import { useEffect, useState, type ReactNode } from 'react';
import { useCurrentUser } from './core/auth.tsx';
import { useRouter } from './core/router.tsx';
import { resolveNavGroups } from './widgets';
import { SidebarNavigation } from './widgets/navigation/SidebarNavigation';
import { Topbar } from './widgets/layout/Topbar';

export function Layout({ children }: { children: ReactNode }) {
  const user = useCurrentUser();
  const { path } = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const navGroups = resolveNavGroups(user);

  useEffect(() => {
    document.documentElement.dataset.theme = user.uiSettings.theme ?? 'slate';
  }, [user.uiSettings.theme]);

  return (
    <div className="shell">
      <SidebarNavigation navGroups={navGroups} path={path} menuOpen={menuOpen} onCloseMenu={() => setMenuOpen(false)} />
      <div className="main">
        <Topbar onOpenMenu={() => setMenuOpen(true)} />
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
