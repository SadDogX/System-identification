import { useState } from 'react';
import type { UiTheme, UserDto } from '@app/shared';
import { api, errorMessage } from '../../core/api.ts';
import { useAuth, useCurrentUser } from '../../core/auth.tsx';
import { useAction } from '../../core/data.ts';
import { Alert, PageHeader } from '@app/shared/ui';

const THEMES: { id: UiTheme; name: string; colors: [string, string, string] }[] = [
  { id: 'slate', name: 'Стальной синий', colors: ['#0057b8', '#f4f6f8', '#ffffff'] },
  { id: 'navy', name: 'Тёмно-синий', colors: ['#17365d', '#f1f4f8', '#ffffff'] },
  { id: 'graphite', name: 'Графит', colors: ['#374151', '#eef0f2', '#ffffff'] },
  { id: 'forest', name: 'Хвойный', colors: ['#315b49', '#f1f5f2', '#ffffff'] },
  { id: 'burgundy', name: 'Бордовый', colors: ['#663b45', '#f6f2f3', '#ffffff'] },
  { id: 'light', name: 'Светлый нейтральный', colors: ['#46515c', '#f8f9fa', '#ffffff'] },
];

/** Страница персональных настроек отображения. Вход: сохранённые настройки пользователя; выход: обновлённая тема интерфейса. */
export function SettingsPage() {
  const user = useCurrentUser();
  const { setUser } = useAuth();
  const [theme, setTheme] = useState<UiTheme>(user.uiSettings.theme ?? 'slate');
  const save = useAction((value: UiTheme) => api.patch<UserDto>('/me/settings', { theme: value }), {
    onSuccess: (next) => { setUser(next); document.documentElement.dataset.theme = next.uiSettings.theme ?? 'slate'; },
  });

  return <>
    <PageHeader title="Настройки интерфейса" subtitle="Персональная строгая цветовая схема рабочего кабинета" />
    {save.error && <Alert>{errorMessage(save.error)}</Alert>}
    {save.done && <Alert kind="success">Тема сохранена.</Alert>}
    <section className="theme-grid" aria-label="Выбор темы">
      {THEMES.map((item) => <button key={item.id} type="button" className={`panel theme-card${theme === item.id ? ' selected' : ''}`} aria-pressed={theme === item.id} onClick={() => setTheme(item.id)}>
        <span className="theme-swatch"><i style={{ background: item.colors[0] }} /><i style={{ background: item.colors[1] }} /><i style={{ background: item.colors[2] }} /></span>
        <strong>{item.name}</strong>
        <span className="muted small">{theme === item.id ? 'Выбрана' : 'Нажмите для выбора'}</span>
      </button>)}
    </section>
    <button className="btn btn-primary" style={{ marginTop: 18 }} disabled={save.pending || theme === (user.uiSettings.theme ?? 'slate')} onClick={() => save.run(theme)}>Сохранить тему</button>
  </>;
}
