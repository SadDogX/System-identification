import { useMemo } from 'react';
import { UI_MESSAGES, translate, type Language } from '@app/shared';
import { useLanguage } from '../core/i18n.tsx';

export function useLocalizedStatusLabels() {
  const { language } = useLanguage();
  return useMemo(() => ({
    GREEN: translate(language, 'status.GREEN'),
    YELLOW: translate(language, 'status.YELLOW'),
    RED: translate(language, 'status.RED'),
    WHITE: translate(language, 'status.WHITE'),
  }), [language]);
}

export function useTranslationLookup() {
  const { language } = useLanguage();
  return (sourceText: string) => {
    if (language === 'ru') return sourceText;
    const find = (value: unknown): string | null => {
      if (typeof value === 'string') return value === sourceText ? '' : null;
      if (!value || typeof value !== 'object') return null;
      for (const [key, child] of Object.entries(value)) {
        const result = find(child);
        if (result !== null) return result ? `${key}.${result}` : key;
      }
      return null;
    };
    const key = find(UI_MESSAGES.ru);
    return key ? translate(language, key) : sourceText;
  };
}

export function translateUi(language: Language, sourceText: string): string {
  if (language === 'ru') return sourceText;
  const visit = (value: unknown, prefix = ''): string | null => {
    if (typeof value === 'string') return value === sourceText ? prefix : null;
    if (!value || typeof value !== 'object') return null;
    for (const [key, child] of Object.entries(value)) {
      const found = visit(child, prefix ? `${prefix}.${key}` : key);
      if (found !== null) return found;
    }
    return null;
  };
  const key = visit(UI_MESSAGES.ru);
  return key ? translate(language, key) : sourceText;
}
