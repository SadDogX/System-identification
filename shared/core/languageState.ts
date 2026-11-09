import type { Language } from './i18n.ts';

let currentLanguage: Language = 'ru';

export function setCurrentLanguage(language: Language) {
  currentLanguage = language;
}

export function getCurrentLanguage(): Language {
  return currentLanguage;
}
