import type { CredentialStatus } from '@app/shared';
import { StatusDot } from '@app/shared/ui';

export type StatusFilter = CredentialStatus | 'ALL';

const OPTIONS: { value: StatusFilter; label: (t: { yellowDays: number; redDays: number }) => string }[] = [
  { value: 'ALL', label: () => 'Все' },
  { value: 'GREEN', label: () => 'Действующие' },
  { value: 'YELLOW', label: (t) => `Заканчиваются ≤ ${t.yellowDays} дн.` },
  { value: 'RED', label: (t) => `≤ ${t.redDays} дн. и истёкшие` },
  { value: 'WHITE', label: () => 'Не заполнены' },
];

interface Props {
  value: StatusFilter;
  onChange: (value: StatusFilter) => void;
  thresholds: { yellowDays: number; redDays: number };
  counts?: Partial<Record<CredentialStatus, number>>;
}

export function QuickFilters({ value, onChange, thresholds, counts }: Props) {
  return (
    <div className="row wrap">
      {OPTIONS.map((o) => {
        const selected = value === o.value;
        const count = o.value !== 'ALL' ? counts?.[o.value] : undefined;
        const tone = o.value === 'ALL' ? 'all' : selected ? `s-${o.value}` : '';
        return (
          <button
            key={o.value}
            type="button"
            className={`chip ${tone}${selected ? ' selected' : ''}`}
            aria-pressed={selected}
            onClick={() => onChange(o.value)}
          >
            {o.value !== 'ALL' && <StatusDot status={o.value} />}
            {o.label(thresholds)}
            {count !== undefined && ` · ${count}`}
          </button>
        );
      })}
    </div>
  );
}
