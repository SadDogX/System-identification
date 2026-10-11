import { createTheme } from '@mui/material/styles';
import { ruRU } from '@mui/material/locale';
import type { CredentialStatus } from '@app/shared';

export const theme = createTheme(
  {
    palette: {
      primary: { main: '#1f4e79' },
      background: { default: '#f4f6f8' },
    },
    shape: { borderRadius: 8 },
    components: {
      MuiButton: { defaultProps: { disableElevation: true } },
      MuiPaper: { defaultProps: { elevation: 0 }, styleOverrides: { root: { border: '1px solid #e3e7eb' } } },
      MuiAppBar: { styleOverrides: { root: { border: 'none' } } },
      MuiDrawer: { styleOverrides: { paper: { border: 'none' } } },
      MuiTextField: { defaultProps: { size: 'small', fullWidth: true } },
    },
  },
  ruRU,
);

/** Цвета статусов. Цвет всегда дублируется текстом и иконкой. */
export const STATUS_COLORS: Record<CredentialStatus, { main: string; bg: string; border: string }> = {
  GREEN: { main: '#2e7d32', bg: '#edf7ee', border: '#a5d6a7' },
  YELLOW: { main: '#b26a00', bg: '#fff6e0', border: '#ffd54f' },
  RED: { main: '#c62828', bg: '#fdecec', border: '#ef9a9a' },
  WHITE: { main: '#6b7280', bg: '#ffffff', border: '#cfd4da' },
};
