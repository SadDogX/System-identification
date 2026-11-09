import { useMemo } from 'react';
import { statusLabels, type CredentialStatus } from '@app/shared';
import { useLanguage } from '../core/i18n.tsx';

export function useLocalizedStatusLabels(): Record<CredentialStatus, string> {
  const { language } = useLanguage();
  return useMemo(() => statusLabels(language), [language]);
}
