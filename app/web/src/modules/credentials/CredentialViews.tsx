import { useState, type ReactNode } from 'react';
import { formatDateRu, type UserCredentialDto, type UserDto, type ViewMode } from '@app/shared';
import { api } from '../../core/api.ts';
import { useAuth } from '../../core/auth.tsx';
import { useIsMobile } from '../../core/data.ts';
import { Link } from '../../core/router.tsx';
import { Icon, StatusBadge } from '@app/shared/ui';

/**
 * Режим «Таблица / Карточки» хранится в настройках пользователя на сервере.
 * На узком экране всегда карточки — таблица там нечитаема.
 */
export function useViewMode(): [ViewMode, (mode: ViewMode) => void, boolean] {
  const { user, setUser } = useAuth();
  const isMobile = useIsMobile();
  const [local, setLocal] = useState<ViewMode>(user?.uiSettings.credentialsView ?? 'table');

  const change = (mode: ViewMode) => {
    setLocal(mode);
    api
      .patch<UserDto>('/me/settings', { credentialsView: mode })
      .then(setUser)
      .catch(() => {});
  };

  return [isMobile ? 'cards' : local, change, isMobile];
}

export function ViewToggle({ value, onChange, hidden }: { value: ViewMode; onChange: (v: ViewMode) => void; hidden?: boolean }) {
  if (hidden) return null;
  return (
    <div className="toggle-group" role="group" aria-label="Вид">
      <button type="button" className={value === 'table' ? 'active' : ''} onClick={() => onChange('table')}>
        <Icon name="table" small /> Таблица
      </button>
      <button type="button" className={value === 'cards' ? 'active' : ''} onClick={() => onChange('cards')}>
        <Icon name="grid" small /> Карточки
      </button>
    </div>
  );
}

interface ViewProps {
  items: UserCredentialDto[];
  /** Показывать столбец «Сотрудник» (общий список у администратора). */
  showUser?: boolean;
  actions?: (item: UserCredentialDto) => ReactNode;
  emptyText?: string;
}

function UserLink({ item }: { item: UserCredentialDto }) {
  return item.user ? <Link to={`/admin/users/${item.user.id}`}>{item.user.fullName}</Link> : null;
}

function MarkedNote({ item }: { item: UserCredentialDto }) {
  return item.isMarkedForDeletion ? <div className="small danger-text">Помечено на удаление</div> : null;
}

export function CredentialTable({ items, showUser, actions, emptyText = 'Нет записей' }: ViewProps) {
  if (items.length === 0) return <div className="empty">{emptyText}</div>;
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            {showUser && <th>Сотрудник</th>}
            <th>Удостоверение</th>
            <th>Номер</th>
            <th>Дата выдачи</th>
            <th>Действительно до</th>
            <th>Статус</th>
            {actions && <th className="actions" />}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className={`bar-${item.status}${item.isMarkedForDeletion ? ' dimmed' : ''}`}>
              {showUser && (
                <td>
                  <UserLink item={item} />
                </td>
              )}
              <td>
                {item.name}
                <MarkedNote item={item} />
              </td>
              <td>{item.number ?? '—'}</td>
              <td>{formatDateRu(item.issueDate)}</td>
              <td>{formatDateRu(item.expiryDate)}</td>
              <td>
                <StatusBadge status={item.status} daysLeft={item.daysLeft} />
              </td>
              {actions && <td className="actions">{actions(item)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CredentialCards({ items, showUser, actions, emptyText = 'Нет записей' }: ViewProps) {
  if (items.length === 0) return <div className="empty">{emptyText}</div>;
  return (
    <div className="cards">
      {items.map((item) => (
        <div key={item.id} className={`cred-card s-${item.status}${item.isMarkedForDeletion ? ' dimmed' : ''}`}>
          <div className="title">{item.name}</div>
          {showUser && <UserLink item={item} />}
          <div>
            <StatusBadge status={item.status} daysLeft={item.daysLeft} />
          </div>
          <div className="kv">
            Номер <b>{item.number ?? '—'}</b>
          </div>
          <div className="kv">
            Дата выдачи <b>{formatDateRu(item.issueDate)}</b>
          </div>
          <div className="kv">
            Действительно до <b>{formatDateRu(item.expiryDate)}</b>
          </div>
          <MarkedNote item={item} />
          {actions && <div className="card-actions">{actions(item)}</div>}
        </div>
      ))}
    </div>
  );
}

/** Таблица — внутри белой панели, карточки — на фоне страницы. */
export function CredentialView({ mode, ...props }: ViewProps & { mode: ViewMode }) {
  return mode === 'table' ? (
    <div className="panel">
      <CredentialTable {...props} />
    </div>
  ) : (
    <CredentialCards {...props} />
  );
}
