import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  DEFAULT_THRESHOLDS,
  DEFAULT_TIMEZONE,
  type AppSettingsDto,
  type AuthResponse,
  type LoginRequest,
  type UserDto,
} from '@app/shared';
import { api, refreshSession, setAccessToken, setSessionHandlers } from '../api/client';

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
  const queryClient = useQueryClient();
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
    queryClient.clear();
  }, [queryClient]);

  useEffect(() => {
    setSessionHandlers({ expired: clearSession, refreshed: applySession });
    // После перезагрузки страницы восстанавливаем сессию по refresh-cookie
    refreshSession()
      .catch(() => clearSession())
      .finally(() => setInitializing(false));
  }, [applySession, clearSession]);

  const login = useCallback(
    async (data: LoginRequest) => {
      const res = await api.post<AuthResponse>('/auth/login', data);
      queryClient.clear();
      applySession(res.data);
      return res.data.user;
    },
    [applySession, queryClient],
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
