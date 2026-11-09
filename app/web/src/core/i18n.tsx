import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { UI_MESSAGES, translate, type Language, type MessageKey, setCurrentLanguage } from '@app/shared';
import { api } from './api.ts';
import { useAuth } from './auth.tsx';

const LANGUAGE_STORAGE_KEY = 'app.language';

function storedLanguage(): Language {
  const value = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  return value === 'en' || value === 'ru' ? value : 'ru';
}

interface LanguageState {
  language: Language;
  setLanguage: (language: Language) => Promise<void>;
  t: (key: MessageKey, values?: Record<string, string | number>) => string;
  translateText: (sourceText: string) => string;
}
const LanguageContext = createContext<LanguageState | null>(null);

function findMessageKey(sourceText: string): string | null {
  const visit = (value: unknown, prefix: string): string | null => {
    if (typeof value === 'string') return value === sourceText ? prefix : null;
    if (!value || typeof value !== 'object') return null;
    for (const [key, child] of Object.entries(value)) {
      const found = visit(child, prefix ? `${prefix}.${key}` : key);
      if (found) return found;
    }
    return null;
  };
  return visit(UI_MESSAGES.ru, '');
}

export function translateText(language: Language, text: string): string {
  if (language === 'ru') return text;
  const key = findMessageKey(text);
  return key ? translate(language, key) : text;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { user, setUser } = useAuth();
  const [localLanguage, setLocalLanguage] = useState<Language>(() => typeof window === 'undefined' ? 'ru' : storedLanguage());
  const language = user?.uiSettings.language ?? localLanguage;
  useEffect(() => {
    setCurrentLanguage(language);
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = useCallback(async (next: Language) => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
    setLocalLanguage(next);
    if (!user) return;
    try {
      setUser(await api.patch<typeof user>('/me/settings', { language: next }));
    } catch {
      // Retain the selected language locally if persistence is unavailable.
    }
  }, [setUser, user]);

  const t = useCallback((key: MessageKey, values?: Record<string, string | number>) => translate(language, key, values), [language]);
  const translateText = useCallback((sourceText: string) => {
    if (language === 'ru') return sourceText;
    const key = findMessageKey(sourceText);
    return key ? translate(language, key) : sourceText;
  }, [language]);
  const value = useMemo(() => ({ language, setLanguage, t, translateText }), [language, setLanguage, t, translateText]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used inside LanguageProvider');
  return context;
}
