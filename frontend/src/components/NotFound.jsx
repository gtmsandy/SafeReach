import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, Home, Compass } from 'lucide-react';

export default function NotFound() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div
      className="screen"
      style={{
        minHeight: '100vh',
        background: 'var(--bg-primary)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* ── Top bar ── */}
      <header className="topbar">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="touch-target flex items-center gap-1"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-secondary)',
          }}
          id="btn-notfound-back"
          aria-label={t('return_home')}
        >
          <ChevronLeft size={22} />
        </button>

        <span className="text-h4">SafeReach</span>

        <div style={{ width: 40 }} />
      </header>

      {/* ── Main Content ── */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12 text-center">
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: 'var(--radius-full)',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 20,
            boxShadow: 'var(--shadow-sm)',
          }}
          aria-hidden="true"
        >
          <Compass size={36} color="var(--accent)" />
        </div>

        <div
          className="text-label"
          style={{
            color: 'var(--accent)',
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            marginBottom: 8,
          }}
        >
          404
        </div>

        <h1
          className="text-h2"
          style={{
            color: 'var(--text-primary)',
            marginBottom: 12,
            lineHeight: 1.25,
          }}
        >
          {t('page_not_found')}
        </h1>

        <p
          className="text-body"
          style={{
            color: 'var(--text-secondary)',
            maxWidth: 340,
            marginBottom: 32,
            lineHeight: 1.5,
          }}
        >
          {t('page_not_found_description')}
        </p>

        <button
          type="button"
          id="btn-notfound-home"
          onClick={() => navigate('/')}
          className="btn-primary touch-target"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            padding: '14px 28px',
            borderRadius: 'var(--radius-lg)',
            cursor: 'pointer',
            fontSize: 15,
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          <Home size={18} aria-hidden="true" />
          <span>{t('return_home')}</span>
        </button>
      </main>
    </div>
  );
}
