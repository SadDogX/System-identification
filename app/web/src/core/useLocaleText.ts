import { useLanguage } from '../core/i18n.tsx';

export function useLocaleText() {
  const { language, t, translateText } = useLanguage();
  return { language, t, localize: translateText };
}
