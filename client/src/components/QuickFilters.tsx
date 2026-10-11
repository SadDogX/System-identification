import { Chip, Stack } from '@mui/material';
import type { CredentialStatus } from '@app/shared';
import { STATUS_COLORS } from '../theme';
import { StatusDot } from './StatusBadge';

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
    <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
      {OPTIONS.map((o) => {
        const selected = value === o.value;
        const count = o.value !== 'ALL' ? counts?.[o.value] : undefined;
        const color = o.value !== 'ALL' ? STATUS_COLORS[o.value] : null;
        return (
          <Chip
            key={o.value}
            icon={o.value !== 'ALL' ? <StatusDot status={o.value} /> : undefined}
            label={count !== undefined ? `${o.label(thresholds)} · ${count}` : o.label(thresholds)}
            onClick={() => onChange(o.value)}
            variant={selected ? 'filled' : 'outlined'}
            sx={{
              pl: o.value !== 'ALL' ? 0.75 : 0,
              fontWeight: selected ? 600 : 400,
              ...(selected && color && { bgcolor: color.bg, borderColor: color.main, border: '1px solid', color: color.main }),
            }}
            color={selected && o.value === 'ALL' ? 'primary' : 'default'}
          />
        );
      })}
    </Stack>
  );
}
