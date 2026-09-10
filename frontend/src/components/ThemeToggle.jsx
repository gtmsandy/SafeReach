import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Sun, Moon } from 'lucide-react';
import { getInitialTheme, setTheme, THEME_CHANGE_EVENT } from '../logic/theme';

export default function ThemeToggle({ theme: propTheme, onThemeChange, className = '' }) {
  const { t } = useTranslation();
  const [theme, setLocalTheme] = useState(() => propTheme || getInitialTheme());

  useEffect(() => {
    if (propTheme && propTheme !== theme) {
      setLocalTheme(propTheme);
    }
  }, [propTheme]);

  useEffect(() => {
    function handleThemeUpdate(event) {
      const updatedTheme = event.detail?.theme || getInitialTheme();
      setLocalTheme(updatedTheme);
    }

    function handleStorage(event) {
      if (event.key === 'safereach_theme') {
        const updatedTheme = event.newValue === 'dark' ? 'dark' : 'light';
        setLocalTheme(updatedTheme);
      }
    }

    window.addEventListener(THEME_CHANGE_EVENT, handleThemeUpdate);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener(THEME_CHANGE_EVENT, handleThemeUpdate);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  function handleSelect(newTheme) {
    if (newTheme === theme) return;
    const applied = setTheme(newTheme);
    setLocalTheme(applied);
    if (typeof onThemeChange === 'function') {
      onThemeChange(applied);
    }
  }

  const isLight = theme === 'light';
  const isDark = theme === 'dark';

  return (
    <div
      role="radiogroup"
      aria-label={t('theme')}
      className={`theme-toggle-container flex items-center gap-2 ${className}`}
      style={{
        background: 'var(--bg-elevated)',
        borderRadius: 'var(--radius-lg)',
        padding: 4,
        border: '1px solid var(--border)',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      <button
        type="button"
        role="radio"
        aria-checked={isLight}
        aria-label={t('switch_to_light')}
        id="btn-theme-light"
        onClick={() => handleSelect('light')}
        className="touch-target flex-1 flex items-center justify-center gap-2"
        style={{
          minHeight: 44,
          padding: '10px 16px',
          borderRadius: 'var(--radius-md)',
          border: 'none',
          cursor: 'pointer',
          fontSize: 14,
          fontWeight: isLight ? 700 : 500,
          background: isLight ? 'var(--bg-card)' : 'transparent',
          color: isLight ? 'var(--text-primary)' : 'var(--text-secondary)',
          boxShadow: isLight ? 'var(--shadow-sm)' : 'none',
          transition: 'all var(--transition-fast)',
        }}
      >
        <Sun
          size={18}
          color={isLight ? 'var(--accent)' : 'var(--text-secondary)'}
          aria-hidden="true"
        />
        <span>{t('light')}</span>
      </button>

      <button
        type="button"
        role="radio"
        aria-checked={isDark}
        aria-label={t('switch_to_dark')}
        id="btn-theme-dark"
        onClick={() => handleSelect('dark')}
        className="touch-target flex-1 flex items-center justify-center gap-2"
        style={{
          minHeight: 44,
          padding: '10px 16px',
          borderRadius: 'var(--radius-md)',
          border: 'none',
          cursor: 'pointer',
          fontSize: 14,
          fontWeight: isDark ? 700 : 500,
          background: isDark ? 'var(--accent)' : 'transparent',
          color: isDark ? '#FFFFFF' : 'var(--text-secondary)',
          boxShadow: isDark ? 'var(--shadow-sm)' : 'none',
          transition: 'all var(--transition-fast)',
        }}
      >
        <Moon
          size={18}
          color={isDark ? '#FFFFFF' : 'var(--text-secondary)'}
          aria-hidden="true"
        />
        <span>{t('dark')}</span>
      </button>
    </div>
  );
}
