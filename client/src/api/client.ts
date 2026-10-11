import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import type { ApiErrorBody, AuthResponse } from '@app/shared';

/** Access-токен живёт только в памяти; refresh — в httpOnly cookie. */
let accessToken: string | null = null;
let onSessionExpired: () => void = () => {};
let onSessionRefreshed: (session: AuthResponse) => void = () => {};

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function setSessionHandlers(handlers: {
  expired: () => void;
  refreshed: (session: AuthResponse) => void;
}) {
  onSessionExpired = handlers.expired;
  onSessionRefreshed = handlers.refreshed;
}

export const api = axios.create({ baseURL: '/api', withCredentials: true });

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

// Один общий refresh на все параллельные запросы, получившие 401
let refreshing: Promise<AuthResponse> | null = null;

export function refreshSession(): Promise<AuthResponse> {
  refreshing ??= axios
    .post<AuthResponse>('/api/auth/refresh', null, { withCredentials: true })
    .then((res) => {
      setAccessToken(res.data.accessToken);
      onSessionRefreshed(res.data);
      return res.data;
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    const isAuthCall = original?.url?.startsWith('/auth/');
    if (error.response?.status === 401 && original && !original._retry && !isAuthCall) {
      original._retry = true;
      try {
        await refreshSession();
        return api(original);
      } catch {
        setAccessToken(null);
        onSessionExpired();
      }
    }
    return Promise.reject(error);
  },
);

export function errorMessage(error: unknown, fallback = 'Произошла ошибка'): string {
  if (error instanceof AxiosError) {
    const body = error.response?.data as ApiErrorBody | undefined;
    if (body?.details) return Object.values(body.details)[0] ?? body.error;
    if (body?.error) return body.error;
    if (!error.response) return 'Сервер недоступен';
  }
  return fallback;
}

export function errorDetails(error: unknown): Record<string, string> {
  if (error instanceof AxiosError) return (error.response?.data as ApiErrorBody | undefined)?.details ?? {};
  return {};
}
