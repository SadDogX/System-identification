import type { ApiErrorBody, AuthResponse } from '@app/shared';

/** Ошибка API с сообщениями по полям формы. */
export class ApiError extends Error {
  status: number;
  details: Record<string, string>;

  constructor(status: number, message: string, details: Record<string, string> = {}) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

/** Access-токен живёт только в памяти; refresh — в httpOnly cookie. */
let accessToken: string | null = null;
let onExpired: () => void = () => {};
let onRefreshed: (session: AuthResponse) => void = () => {};

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function setSessionHandlers(handlers: { expired: () => void; refreshed: (s: AuthResponse) => void }) {
  onExpired = handlers.expired;
  onRefreshed = handlers.refreshed;
}

type Query = Record<string, string | number | boolean | null | undefined>;

function buildUrl(path: string, query?: Query): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== '' && value !== false) params.set(key, String(value));
  }
  const qs = params.toString();
  return `/api${path}${qs ? `?${qs}` : ''}`;
}

/** Файл (Blob) уходит в теле запроса как есть, остальное — JSON. Ответ — JSON или Blob. */
async function send<T>(method: string, path: string, body?: unknown, query?: Query, asBlob = false): Promise<T> {
  const isFile = body instanceof Blob;
  let res: Response;
  try {
    res = await fetch(buildUrl(path, query), {
      method,
      credentials: 'same-origin',
      headers: {
        ...(body !== undefined && { 'Content-Type': isFile ? body.type || 'application/octet-stream' : 'application/json' }),
        ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
      },
      body: body === undefined ? undefined : isFile ? body : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'Сервер недоступен');
  }
  if (asBlob && res.ok) return (await res.blob()) as T;
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const err = data as ApiErrorBody | null;
    throw new ApiError(res.status, err?.error ?? 'Произошла ошибка', err?.details);
  }
  return data as T;
}

// Один общий refresh на все параллельные запросы, получившие 401
let refreshing: Promise<AuthResponse> | null = null;

export function refreshSession(): Promise<AuthResponse> {
  refreshing ??= send<AuthResponse>('POST', '/auth/refresh')
    .then((session) => {
      setAccessToken(session.accessToken);
      onRefreshed(session);
      return session;
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

async function request<T>(method: string, path: string, body?: unknown, query?: Query, asBlob = false): Promise<T> {
  try {
    return await send<T>(method, path, body, query, asBlob);
  } catch (err) {
    // Истёк access-токен — пробуем обновить сессию один раз
    if (err instanceof ApiError && err.status === 401 && !path.startsWith('/auth/')) {
      try {
        await refreshSession();
      } catch {
        setAccessToken(null);
        onExpired();
        throw err;
      }
      return send<T>(method, path, body, query, asBlob);
    }
    throw err;
  }
}

export const api = {
  get: <T>(path: string, query?: Query) => request<T>('GET', path, undefined, query),
  post: <T = void>(path: string, body?: unknown) => request<T>('POST', path, body),
  patch: <T = void>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  put: <T = void>(path: string, body?: unknown) => request<T>('PUT', path, body),
  delete: <T = void>(path: string) => request<T>('DELETE', path),
  /** Загрузка файла в теле запроса. */
  upload: <T = void>(path: string, file: Blob) => request<T>('PUT', path, file),
  /** Скачивание файла с авторизацией (для фото удостоверений). */
  blob: (path: string) => request<Blob>('GET', path, undefined, undefined, true),
};

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return Object.values(error.details)[0] ?? error.message;
  return 'Произошла ошибка';
}

export function errorDetails(error: unknown): Record<string, string> {
  return error instanceof ApiError ? error.details : {};
}
