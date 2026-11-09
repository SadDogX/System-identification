import type { ViewMode } from '@app/shared';
import { Icon } from '@app/shared/ui';
import { useLanguage } from '../../core/i18n.tsx';
import { APP_MESSAGES, appMessage } from '../../core/appMessages.ts';

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
  tableLabel,
}: ViewToggleProps) {
  const { language } = useLanguage();
  const m = (key: keyof typeof APP_MESSAGES.ru) => appMessage(language, key);
  if (hidden) return null;

  const cardsButton = (
    <button type="button" className={value === 'cards' ? 'active' : ''} onClick={() => onChange('cards')}>
      {showIcons && <Icon name="grid" small />} {m('cards')}
    </button>
  );
  const tableButton = (
    <button type="button" className={value === 'table' ? 'active' : ''} onClick={() => onChange('table')}>
      {showIcons && <Icon name="table" small />} {tableLabel || m('table')}
    </button>
  );

  return (
    <div className="toggle-group" role="group" aria-label={m('view')}>
      {cardsFirst ? cardsButton : tableButton}
      {cardsFirst ? tableButton : cardsButton}
    </div>
  );
}
