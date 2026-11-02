export type Theme = 'light' | 'dark' | 'system';

const THEME_STORAGE_KEY = 'glucotrack_theme';

export function isTheme(val: unknown): val is Theme {
  return val === 'light' || val === 'dark' || val === 'system';
}

export function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';
  const saved = localStorage.getItem(THEME_STORAGE_KEY);
  if (isTheme(saved)) {
    return saved;
  }
  // По умолчанию предпочитаем темную тему как наиболее комфортную для медицинских дашбордов
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  const isDark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  if (isDark) {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }

  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Ignore storage errors
  }
}
