import { UI_MESSAGES, translate, type Language } from '@app/shared';

let activeLanguage: Language = 'ru';

export function setActiveLanguage(language: Language) {
  activeLanguage = language;
}

export function getActiveLanguage() {
  return activeLanguage;
}

function findMessageKey(sourceText: string): string | null {
  const visit = (value: unknown, prefix: string): string | null => {
    if (typeof value === 'string') return value === sourceText ? prefix : null;
    if (!value || typeof value !== 'object') return null;
    for (const [key, child] of Object.entries(value)) {
      const found = visit(child, prefix ? `${prefix}.${key}` : key);
      if (found !== null) return found;
    }
    return null;
  };
  return visit(UI_MESSAGES.ru, '');
}

export function translateSourceText(sourceText: string, language = activeLanguage) {
  if (language === 'ru') return sourceText;
  const key = findMessageKey(sourceText);
  return key ? translate(language, key) : sourceText;
}
