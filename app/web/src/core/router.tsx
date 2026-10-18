import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type MouseEvent,
  type ReactNode,
} from 'react';

// Небольшой роутер на History API вместо react-router.

interface RouterState {
  path: string;
  search: URLSearchParams;
  navigate: (to: string, opts?: { replace?: boolean }) => void;
}

const RouterContext = createContext<RouterState | null>(null);

function readLocation() {
  return { path: window.location.pathname, search: window.location.search };
}

export function RouterProvider({ children }: { children: ReactNode }) {
  const [location, setLocation] = useState(readLocation);

  useEffect(() => {
    const onPop = () => setLocation(readLocation());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigate = useCallback((to: string, opts: { replace?: boolean } = {}) => {
    if (to === window.location.pathname + window.location.search) return;
    if (opts.replace) window.history.replaceState(null, '', to);
    else window.history.pushState(null, '', to);
    setLocation(readLocation());
    window.scrollTo(0, 0);
  }, []);

  const value = useMemo(
    () => ({ path: location.path, search: new URLSearchParams(location.search), navigate }),
    [location, navigate],
  );
  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

export function useRouter(): RouterState {
  const ctx = useContext(RouterContext);
  if (!ctx) throw new Error('useRouter вне RouterProvider');
  return ctx;
}

/** Сопоставляет путь с шаблоном вида /admin/users/:id; возвращает параметры или null. */
export function matchPath(pattern: string, path: string): Record<string, string> | null {
  const p = pattern.split('/').filter(Boolean);
  const s = path.split('/').filter(Boolean);
  if (p.length !== s.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < p.length; i++) {
    if (p[i].startsWith(':')) params[p[i].slice(1)] = decodeURIComponent(s[i]);
    else if (p[i] !== s[i]) return null;
  }
  return params;
}

/** Параметр строки запроса как состояние: ?status=RED */
export function useSearchParam(name: string): [string | null, (value: string | null) => void] {
  const { path, search, navigate } = useRouter();
  const set = useCallback(
    (value: string | null) => {
      const next = new URLSearchParams(search);
      if (value === null || value === '') next.delete(name);
      else next.set(name, value);
      const qs = next.toString();
      navigate(path + (qs ? `?${qs}` : ''), { replace: true });
    },
    [name, path, search, navigate],
  );
  return [search.get(name), set];
}

interface LinkProps {
  to: string;
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}

export function Link({ to, children, className, onClick }: LinkProps) {
  const { navigate } = useRouter();
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    // Ctrl/Cmd+клик — открыть в новой вкладке как обычно
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    onClick?.();
    navigate(to);
  };
  return (
    <a href={to} className={className} onClick={handle}>
      {children}
    </a>
  );
}

export function Redirect({ to }: { to: string }) {
  const { navigate } = useRouter();
  useEffect(() => navigate(to, { replace: true }), [to, navigate]);
  return null;
}
