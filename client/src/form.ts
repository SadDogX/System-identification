import { useCallback, useState, type ChangeEvent } from 'react';
import { parse, type Validator } from '@app/shared';
import { errorDetails } from './api.ts';

type Values = Record<string, string | boolean>;

/**
 * Состояние формы без библиотек: значения, ошибки по полям,
 * проверка той же схемой, что и на сервере.
 */
export function useForm<T extends Values>(initial: T) {
  const [values, setValues] = useState<T>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => (e[key as string] ? { ...e, [key]: '' } : e));
  }, []);

  /** Пропсы для текстового поля / select. */
  const field = (key: keyof T & string) => ({
    name: key,
    value: String(values[key] ?? ''),
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => set(key, e.target.value as T[typeof key]),
    error: errors[key] || undefined,
  });

  /** Проверить схемой; при ошибке — показать сообщения и вернуть null. */
  const validate = <R>(schema: Validator<R>, data: unknown = values): R | null => {
    const result = parse(schema, data);
    if (!result.ok) {
      setErrors(result.issues);
      return null;
    }
    setErrors({});
    return result.value;
  };

  /** Ошибки сервера по полям — в форму; возвращает true, если такие были. */
  const applyServerErrors = (error: unknown): boolean => {
    const details = errorDetails(error);
    if (Object.keys(details).length === 0) return false;
    setErrors(details);
    return true;
  };

  const reset = useCallback((next: T) => {
    setValues(next);
    setErrors({});
  }, []);

  return { values, errors, set, field, validate, applyServerErrors, reset, setErrors };
}
