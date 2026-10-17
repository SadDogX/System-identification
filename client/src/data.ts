import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from './api.ts';

// Простая загрузка данных вместо react-query: ключ, перезагрузка, общая инвалидация.

type Listener = (key: string) => void;
const listeners = new Set<Listener>();

/** Перезагрузить все данные, ключ которых начинается с prefix (например, 'admin'). */
export function invalidate(prefix: string) {
  for (const listener of listeners) listener(prefix);
}

interface QueryState<T> {
  data: T | undefined;
  error: string | null;
  loading: boolean;
  reload: () => void;
}

/**
 * Загружает данные по ключу; перезагружает при смене ключа, при invalidate(prefix)
 * и, если задано, по таймеру. Пока идёт перезагрузка, показываются прежние данные.
 */
export function useQuery<T>(
  key: string | null,
  load: () => Promise<T>,
  opts: { refreshMs?: number } = {},
): QueryState<T> {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(key !== null);
  const [version, setVersion] = useState(0);
  const loadRef = useRef(load);
  loadRef.current = load;

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    if (key === null) return;
    let cancelled = false;
    setLoading(true);
    loadRef
      .current()
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setError(null);
      })
      .catch((err) => !cancelled && setError(errorMessage(err)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [key, version]);

  useEffect(() => {
    if (key === null) return;
    const listener: Listener = (prefix) => key.startsWith(prefix) && reload();
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, [key, reload]);

  useEffect(() => {
    if (key === null || !opts.refreshMs) return;
    const timer = setInterval(reload, opts.refreshMs);
    return () => clearInterval(timer);
  }, [key, opts.refreshMs, reload]);

  return { data, error, loading, reload };
}

interface ActionState<A extends unknown[]> {
  /** Выполнить действие; true — успешно. */
  run: (...args: A) => Promise<boolean>;
  pending: boolean;
  error: unknown;
  done: boolean;
  reset: () => void;
}

/** Действие с состоянием «выполняется / ошибка / готово». */
export function useAction<A extends unknown[], R>(
  fn: (...args: A) => Promise<R>,
  opts: { onSuccess?: (result: R, ...args: A) => void; onError?: (error: unknown) => void } = {},
): ActionState<A> {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [done, setDone] = useState(false);
  const ref = useRef({ fn, opts });
  ref.current = { fn, opts };

  const run = useCallback(async (...args: A) => {
    setPending(true);
    setError(null);
    setDone(false);
    try {
      const result = await ref.current.fn(...args);
      setDone(true);
      ref.current.opts.onSuccess?.(result, ...args);
      return true;
    } catch (err) {
      setError(err);
      ref.current.opts.onError?.(err);
      return false;
    } finally {
      setPending(false);
    }
  }, []);

  const reset = useCallback(() => {
    setError(null);
    setDone(false);
  }, []);

  return { run, pending, error, done, reset };
}

/** true на узком экране (меньше 900px) — там вместо таблиц карточки. */
export function useIsMobile(): boolean {
  const query = '(max-width: 899px)';
  const [mobile, setMobile] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMobile(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);
  return mobile;
}
