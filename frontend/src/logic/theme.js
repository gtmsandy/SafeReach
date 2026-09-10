export const THEME_STORAGE_KEY = 'safereach_theme';
export const THEME_CHANGE_EVENT = 'safereach_theme_changed';

/**
 * Determine initial theme from localStorage, or system preference, defaulting to 'light'.
 * @returns {'light' | 'dark'}
 */
export function getInitialTheme() {
  if (typeof window === 'undefined') return 'light';
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') {
      return saved;
    }
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
  } catch {}
  return 'light';
}

/**
 * Apply theme to document root element.
 * Sets .dark class and data-theme attribute on document.documentElement.
 * @param {'light' | 'dark'} theme
 */
export function applyTheme(theme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const isDark = theme === 'dark';
  if (isDark) {
    root.classList.add('dark');
    root.setAttribute('data-theme', 'dark');
  } else {
    root.classList.remove('dark');
    root.setAttribute('data-theme', 'light');
  }

  // Update theme-color meta tag if present
  try {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute('content', isDark ? '#0A1628' : '#1B3A5C');
    }
  } catch {}
}

/**
 * Persist and apply selected theme, and dispatch change notification.
 * @param {'light' | 'dark'} theme
 * @returns {'light' | 'dark'}
 */
export function setTheme(theme) {
  const validTheme = theme === 'dark' ? 'dark' : 'light';
  try {
    localStorage.setItem(THEME_STORAGE_KEY, validTheme);
  } catch {}
  applyTheme(validTheme);
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    try {
      window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT, { detail: { theme: validTheme } }));
    } catch {}
  }
  return validTheme;
}

/**
 * Toggle between light and dark theme.
 * @param {'light' | 'dark'} [currentTheme]
 * @returns {'light' | 'dark'}
 */
export function toggleTheme(currentTheme) {
  const active = currentTheme || getInitialTheme();
  const next = active === 'dark' ? 'light' : 'dark';
  return setTheme(next);
}

/**
 * Initialize theme on app bootstrap.
 * @returns {'light' | 'dark'}
 */
export function initTheme() {
  const theme = getInitialTheme();
  applyTheme(theme);
  return theme;
}
