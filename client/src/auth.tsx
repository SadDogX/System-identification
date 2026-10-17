import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  DEFAULT_THRESHOLDS,
  DEFAULT_TIMEZONE,
  type AppSettingsDto,
  type AuthResponse,
  type LoginRequest,
  type Role,
  type UserDto,
} from '@app/shared';
import { api, refreshSession, setAccessToken, setSessionHandlers } from './api.ts';
import { Redirect, useRouter } from './router.tsx';
import { Spinner } from './components/ui.tsx';

interface AuthState {
  user: UserDto | null;
  settings: AppSettingsDto;
  /** true, пока при загрузке страницы восстанавливается сессия. */
  initializing: boolean;
  login: (data: LoginRequest) => Promise<UserDto>;
  logout: () => Promise<void>;
  applySession: (session: AuthResponse) => void;
  setUser: (user: UserDto) => void;
}

const AuthContext = createContext<AuthState | null>(null);

const DEFAULT_SETTINGS: AppSettingsDto = { ...DEFAULT_THRESHOLDS, timezone: DEFAULT_TIMEZONE };

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserDto | null>(null);
  const [settings, setSettings] = useState<AppSettingsDto>(DEFAULT_SETTINGS);
  const [initializing, setInitializing] = useState(true);

  const applySession = useCallback((session: AuthResponse) => {
    setAccessToken(session.accessToken);
    setUser(session.user);
    setSettings(session.settings);
  }, []);

  const clearSession = useCallback(() => {
    setAccessToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    setSessionHandlers({ expired: clearSession, refreshed: applySession });
    // После перезагрузки страницы восстанавливаем сессию по refresh-cookie
    refreshSession()
      .catch(() => clearSession())
      .finally(() => setInitializing(false));
  }, [applySession, clearSession]);

  const login = useCallback(
    async (data: LoginRequest) => {
      const session = await api.post<AuthResponse>('/auth/login', data);
      applySession(session);
      return session.user;
    },
    [applySession],
  );

  const logout = useCallback(async () => {
    await api.post('/auth/logout').catch(() => {});
    clearSession();
  }, [clearSession]);

  const value = useMemo(
    () => ({ user, settings, initializing, login, logout, applySession, setUser }),
    [user, settings, initializing, login, logout, applySession],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth вне AuthProvider');
  return ctx;
}

/** Пользователь внутри защищённых страниц — гарантированно есть. */
export function useCurrentUser(): UserDto {
  const { user } = useAuth();
  if (!user) throw new Error('Нет авторизованного пользователя');
  return user;
}

export const homePath = (user: UserDto) => (user.role === 'ADMIN' ? '/admin/dashboard' : '/user/dashboard');

/** Только UX: реальная проверка прав выполняется на сервере. */
export function Protected({ role, children }: { role?: Role; children: ReactNode }) {
  const { user, initializing } = useAuth();
  const { path } = useRouter();

  if (initializing) return <Spinner />;
  if (!user) return <Redirect to="/login" />;
  if (user.mustChangePassword && path !== '/change-password') return <Redirect to="/change-password" />;
  if (role && user.role !== role) return <Redirect to={homePath(user)} />;
  return <>{children}</>;
}
