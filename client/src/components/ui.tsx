import { useEffect, useId, useRef, useState, type ReactNode, type SelectHTMLAttributes, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { Icon } from './Icon.tsx';

// Базовые элементы интерфейса вместо UI-библиотеки.

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="page-header">
      <div>
        <h1 className="page-title">{title}</h1>
        {subtitle && <div className="page-subtitle">{subtitle}</div>}
      </div>
      {actions && <div className="row wrap">{actions}</div>}
    </div>
  );
}

export function Alert({ kind = 'error', children }: { kind?: 'error' | 'success' | 'info'; children: ReactNode }) {
  return <div className={`alert alert-${kind}`} role={kind === 'error' ? 'alert' : 'status'}>{children}</div>;
}

export function Spinner() {
  return (
    <div className="loader">
      <div className="spinner" aria-label="Загрузка" />
    </div>
  );
}

interface FieldBase {
  label: string;
  error?: string;
  help?: string;
}

function FieldWrap({ id, label, error, help, children }: FieldBase & { id: string; children: ReactNode }) {
  return (
    <div className={`field${error ? ' invalid' : ''}`}>
      <label htmlFor={id}>{label}</label>
      {children}
      {(error || help) && <div className="help">{error ?? help}</div>}
    </div>
  );
}

export function TextField({ label, error, help, ...input }: FieldBase & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <FieldWrap id={id} label={label} error={error} help={help}>
      <input id={id} className="input" aria-invalid={!!error} {...input} />
    </FieldWrap>
  );
}

/** Поле пароля с кнопкой «показать / скрыть». */
export function PasswordField({ label, error, help, ...input }: FieldBase & Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  return (
    <FieldWrap id={id} label={label} error={error} help={help}>
      <div className="password">
        <input id={id} className="input" type={visible ? 'text' : 'password'} aria-invalid={!!error} {...input} />
        <button
          type="button"
          className="icon-btn"
          title={visible ? 'Скрыть пароль' : 'Показать пароль'}
          aria-label={visible ? 'Скрыть пароль' : 'Показать пароль'}
          aria-pressed={visible}
          onClick={() => setVisible((v) => !v)}
        >
          <Icon name={visible ? 'eyeOff' : 'eye'} />
        </button>
      </div>
    </FieldWrap>
  );
}

export function TextArea({ label, error, help, ...input }: FieldBase & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  return (
    <FieldWrap id={id} label={label} error={error} help={help}>
      <textarea id={id} className="input" aria-invalid={!!error} {...input} />
    </FieldWrap>
  );
}

export function SelectField({ label, error, help, children, ...select }: FieldBase & SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId();
  return (
    <FieldWrap id={id} label={label} error={error} help={help}>
      <select id={id} className="input" aria-invalid={!!error} {...select}>
        {children}
      </select>
    </FieldWrap>
  );
}

export function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="search grow">
      <Icon name="search" small />
      <input className="input" type="search" value={value} placeholder={placeholder} aria-label={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export function Checkbox({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className="check">
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

interface DialogProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  actions: ReactNode;
  wide?: boolean;
  /** Если задано — содержимое оборачивается в форму (Enter отправляет). */
  onSubmit?: () => void;
}

export function Dialog({ open, title, onClose, children, actions, wide, onSubmit }: DialogProps) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  // Только при открытии: Escape закрывает, фокус — на первое поле
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current();
    document.addEventListener('keydown', onKey);
    ref.current?.querySelector<HTMLElement>('input, select, textarea, button')?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open) return null;
  const body = (
    <>
      <div className="dialog-title">{title}</div>
      <div className="dialog-body">{children}</div>
      <div className="dialog-actions">{actions}</div>
    </>
  );
  return (
    <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} className={`dialog${wide ? ' wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        {onSubmit ? (
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              onSubmit();
            }}
          >
            {body}
          </form>
        ) : (
          body
        )}
      </div>
    </div>
  );
}

interface ConfirmProps {
  open: boolean;
  title: string;
  text: string;
  confirmText?: string;
  danger?: boolean;
  disabled?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  children?: ReactNode;
}

export function ConfirmDialog({ open, title, text, confirmText = 'Подтвердить', danger, disabled, onConfirm, onClose, children }: ConfirmProps) {
  return (
    <Dialog
      open={open}
      title={title}
      onClose={onClose}
      actions={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Отмена
          </button>
          <button type="button" className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} disabled={disabled} onClick={onConfirm}>
            {confirmText}
          </button>
        </>
      }
    >
      <div className="muted">{text}</div>
      {children}
    </Dialog>
  );
}

export function Pager({
  total,
  page,
  pageSize,
  sizes,
  onPage,
  onPageSize,
}: {
  total: number;
  page: number;
  pageSize: number;
  sizes: number[];
  onPage: (page: number) => void;
  onPageSize: (size: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <div className="pager">
      <label className="row">
        Строк на странице:
        <select value={pageSize} onChange={(e) => onPageSize(Number(e.target.value))}>
          {sizes.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>
      <span>
        {from}–{to} из {total}
      </span>
      <div className="row">
        <button type="button" className="btn btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          ‹ Назад
        </button>
        <button type="button" className="btn btn-sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Вперёд ›
        </button>
      </div>
    </div>
  );
}

/** Закрывает выпадающее меню по клику вне его. */
export function useClickOutside(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);
  return ref;
}
