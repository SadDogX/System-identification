import type { ViewMode } from '@app/shared';
import { Icon } from '@app/shared/ui';

interface ViewToggleProps {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
  hidden?: boolean;
  showIcons?: boolean;
  cardsFirst?: boolean;
  tableLabel?: string;
}

export function ViewToggle({
  value,
  onChange,
  hidden,
  showIcons = true,
  cardsFirst = false,
  tableLabel = 'Таблица',
}: ViewToggleProps) {
  if (hidden) return null;

  const cardsButton = (
    <button type="button" className={value === 'cards' ? 'active' : ''} onClick={() => onChange('cards')}>
      {showIcons && <Icon name="grid" small />} Карточки
    </button>
  );
  const tableButton = (
    <button type="button" className={value === 'table' ? 'active' : ''} onClick={() => onChange('table')}>
      {showIcons && <Icon name="table" small />} {tableLabel}
    </button>
  );

  return (
    <div className="toggle-group" role="group" aria-label="Вид">
      {cardsFirst ? cardsButton : tableButton}
      {cardsFirst ? tableButton : cardsButton}
    </div>
  );
}
