import { useState } from 'react';
import { useMediaQuery, useTheme } from '@mui/material';
import type { UserDto, ViewMode } from '@app/shared';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';

/**
 * Режим «Таблица / Карточки» хранится в настройках пользователя на сервере.
 * На узком экране всегда карточки — таблица там нечитаема.
 */
export function useViewMode(): [ViewMode, (mode: ViewMode) => void, boolean] {
  const { user, setUser } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [local, setLocal] = useState<ViewMode>(user?.uiSettings.credentialsView ?? 'table');

  const change = (mode: ViewMode) => {
    setLocal(mode);
    api
      .patch<UserDto>('/me/settings', { credentialsView: mode })
      .then((res) => setUser(res.data))
      .catch(() => {});
  };

  return [isMobile ? 'cards' : local, change, isMobile];
}
