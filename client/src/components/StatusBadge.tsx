import { STATUS_LABELS, daysLeftText, type CredentialStatus } from '@app/shared';
import { Icon, type IconName } from './Icon.tsx';

const STATUS_ICONS: Record<CredentialStatus, IconName> = {
  GREEN: 'check',
  YELLOW: 'warning',
  RED: 'error',
  WHITE: 'circle',
};

export function StatusIcon({ status }: { status: CredentialStatus }) {
  return <Icon name={STATUS_ICONS[status]} className={`c-${status}`} />;
}

/** Цвет + иконка + текст: статус понятен и без различения цветов. */
export function StatusBadge({ status, daysLeft }: { status: CredentialStatus; daysLeft: number | null }) {
  return (
    <span className={`status s-${status}`}>
      <Icon name={STATUS_ICONS[status]} />
      {status === 'WHITE' ? STATUS_LABELS.WHITE : daysLeftText(daysLeft)}
    </span>
  );
}

export function StatusDot({ status }: { status: CredentialStatus }) {
  return <span className={`dot c-${status}`} aria-hidden="true" />;
}
