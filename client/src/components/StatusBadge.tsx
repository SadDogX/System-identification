import { Box, Chip } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import { STATUS_LABELS, daysLeftText, type CredentialStatus } from '@app/shared';
import { STATUS_COLORS } from '../theme';

export const STATUS_ICONS: Record<CredentialStatus, typeof CheckCircleIcon> = {
  GREEN: CheckCircleIcon,
  YELLOW: WarningAmberIcon,
  RED: ErrorIcon,
  WHITE: RadioButtonUncheckedIcon,
};

export function StatusIcon({ status, fontSize = 'small' }: { status: CredentialStatus; fontSize?: 'small' | 'medium' }) {
  const Icon = STATUS_ICONS[status];
  return <Icon fontSize={fontSize} sx={{ color: STATUS_COLORS[status].main }} />;
}

/** Цвет + иконка + текст: статус понятен и без различения цветов. */
export function StatusBadge({ status, daysLeft }: { status: CredentialStatus; daysLeft: number | null }) {
  const c = STATUS_COLORS[status];
  return (
    <Chip
      size="small"
      icon={<StatusIcon status={status} />}
      label={status === 'WHITE' ? STATUS_LABELS.WHITE : daysLeftText(daysLeft)}
      variant="outlined"
      sx={{ bgcolor: c.bg, borderColor: c.border, color: c.main, fontWeight: 500, '& .MuiChip-icon': { color: c.main } }}
    />
  );
}

export function StatusDot({ status }: { status: CredentialStatus }) {
  const c = STATUS_COLORS[status];
  return (
    <Box
      component="span"
      sx={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', bgcolor: status === 'WHITE' ? '#fff' : c.main, border: `2px solid ${status === 'WHITE' ? c.border : c.main}` }}
    />
  );
}
