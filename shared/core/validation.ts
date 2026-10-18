/**
 * Минимальная валидация без внешних библиотек. Валидатор — функция, которая
 * возвращает очищенное значение или INVALID и записывает сообщение об ошибке.
 * Лишние поля объектов отбрасываются.
 */

export type Issues = Record<string, string>;
export type Result<T> = { ok: true; value: T } | { ok: false; issues: Issues };

const INVALID: unique symbol = Symbol('invalid');
type Invalid = typeof INVALID;

export type Validator<T> = (value: unknown, path: string, issues: Issues) => T | Invalid;
export type Infer<V> = V extends Validator<infer T> ? T : never;

function fail(issues: Issues, path: string, message: string): Invalid {
  issues[path || '_'] ??= message;
  return INVALID;
}

export function parse<T>(validator: Validator<T>, input: unknown): Result<T> {
  const issues: Issues = {};
  const value = validator(input, '', issues);
  if (value === INVALID || Object.keys(issues).length > 0) return { ok: false, issues };
  return { ok: true, value };
}

interface TextOptions {
  min?: number;
  max: number;
  /** Сообщение, если строка короче min (в том числе пустая). */
  message?: string;
  pattern?: [RegExp, string];
}

/** Обязательная строка; пробелы по краям обрезаются. */
export function text(opts: TextOptions): Validator<string> {
  return (value, path, issues) => {
    if (typeof value !== 'string') return fail(issues, path, opts.message ?? 'Обязательное поле');
    const v = value.trim();
    if (v.length < (opts.min ?? 1)) return fail(issues, path, opts.message ?? `Не менее ${opts.min ?? 1} символов`);
    if (v.length > opts.max) return fail(issues, path, `Не более ${opts.max} символов`);
    if (opts.pattern && !opts.pattern[0].test(v)) return fail(issues, path, opts.pattern[1]);
    return v;
  };
}

/** Строка без обрезки пробелов (пароли). */
export function rawText(opts: { min: number; max: number; message: string }): Validator<string> {
  return (value, path, issues) => {
    if (typeof value !== 'string' || value.length < opts.min) return fail(issues, path, opts.message);
    if (value.length > opts.max) return fail(issues, path, `Не более ${opts.max} символов`);
    return value;
  };
}

/** Необязательная строка: не передана → undefined, пустая → null. */
export function optionalText(max: number, check?: [(v: string) => boolean, string]): Validator<string | null | undefined> {
  return (value, path, issues) => {
    if (value === undefined) return undefined;
    if (value === null) return null;
    if (typeof value !== 'string') return fail(issues, path, 'Ожидается строка');
    const v = value.trim();
    if (v === '') return null;
    if (v.length > max) return fail(issues, path, `Не более ${max} символов`);
    if (check && !check[0](v)) return fail(issues, path, check[1]);
    return v;
  };
}

export function oneOf<const T extends readonly string[]>(values: T, message = 'Недопустимое значение'): Validator<T[number]> {
  return (value, path, issues) =>
    typeof value === 'string' && values.includes(value) ? (value as T[number]) : fail(issues, path, message);
}

/** Целое число; строки из query приводятся к числу. */
export function int(opts: { min?: number; max?: number; default?: number; message?: string } = {}): Validator<number> {
  return (value, path, issues) => {
    if ((value === undefined || value === '') && opts.default !== undefined) return opts.default;
    const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
    if (typeof n !== 'number' || !Number.isInteger(n)) return fail(issues, path, opts.message ?? 'Ожидается целое число');
    if (opts.min !== undefined && n < opts.min) return fail(issues, path, opts.message ?? `Не меньше ${opts.min}`);
    if (opts.max !== undefined && n > opts.max) return fail(issues, path, opts.message ?? `Не больше ${opts.max}`);
    return n;
  };
}

export function bool(): Validator<boolean> {
  return (value, path, issues) => (typeof value === 'boolean' ? value : fail(issues, path, 'Ожидается да/нет'));
}

/** 'true' / 'false' из строки запроса. */
export function queryBool(): Validator<boolean | undefined> {
  return (value, path, issues) => {
    if (value === undefined || value === '') return undefined;
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return fail(issues, path, 'Ожидается true или false');
  };
}

/** Ссылка на запись справочника: не передана → undefined, пустая → null (сбросить). */
export function optionalId(): Validator<number | null | undefined> {
  return (value, path, issues) => {
    if (value === undefined) return undefined;
    if (value === null || value === '') return null;
    const n = typeof value === 'string' ? Number(value) : value;
    return typeof n === 'number' && Number.isInteger(n) && n > 0 ? n : fail(issues, path, 'Некорректное значение');
  };
}

/** Значение, проходящее проверку-предикат. */
export function matches<T>(guard: (v: unknown) => v is T, message: string): Validator<T> {
  return (value, path, issues) => (guard(value) ? value : fail(issues, path, message));
}

/** Значение может отсутствовать. */
export function optional<T>(validator: Validator<T>): Validator<T | undefined> {
  return (value, path, issues) => (value === undefined || value === '' ? undefined : validator(value, path, issues));
}

/** Проверка с собственным условием. */
export function check<T>(validator: Validator<T>, ok: (v: T) => boolean, message: string): Validator<T> {
  return (value, path, issues) => {
    const v = validator(value, path, issues);
    if (v === INVALID) return v;
    return ok(v) ? v : fail(issues, path, message);
  };
}

type Shape = Record<string, Validator<unknown>>;
type Simplify<T> = { [K in keyof T]: T[K] };
/** Поля, валидатор которых допускает undefined, становятся необязательными. */
type OptionalKeys<S extends Shape> = { [K in keyof S]: undefined extends Infer<S[K]> ? K : never }[keyof S];
type ObjectOf<S extends Shape> = Simplify<
  { [K in Exclude<keyof S, OptionalKeys<S>>]: Infer<S[K]> } & { [K in OptionalKeys<S>]?: Infer<S[K]> }
>;

export function object<S extends Shape>(
  shape: S,
  /** Проверка всего объекта: вернуть [поле, сообщение] при ошибке. */
  refine?: (value: ObjectOf<S>) => [string, string] | null,
): Validator<ObjectOf<S>> {
  return (value, path, issues) => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return fail(issues, path, 'Ожидается объект');
    }
    const out: Record<string, unknown> = {};
    let failed = false;
    for (const [key, validator] of Object.entries(shape)) {
      const v = validator((value as Record<string, unknown>)[key], path ? `${path}.${key}` : key, issues);
      if (v === INVALID) failed = true;
      else if (v !== undefined) out[key] = v;
    }
    if (failed) return INVALID;
    const result = out as ObjectOf<S>;
    const problem = refine?.(result);
    return problem ? fail(issues, problem[0], problem[1]) : result;
  };
}
