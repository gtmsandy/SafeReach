import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldAlert, Shield } from 'lucide-react';
import { triggerSilentSOS } from '../logic/silentSOS';

export default function SilentSOSButton({ country }) {
  const { t } = useTranslation();
  const [showSetup, setShowSetup] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [contact, setContact] = useState(() =>
    JSON.parse(localStorage.getItem('sos_contact') || '{}')
  );
  const [pressed, setPressed] = useState(false);

  function handleSaveContact() {
    if (!name.trim() || !phone.trim()) return;
    const saved = { name: name.trim(), phone: phone.trim() };
    localStorage.setItem('sos_contact', JSON.stringify(saved));
    setContact(saved);
    setShowSetup(false);
    triggerSilentSOS(country);
  }

  async function handlePress() {
    setPressed(true);
    setTimeout(() => setPressed(false), 200);

    const saved = JSON.parse(localStorage.getItem('sos_contact') || '{}');
    if (!saved.phone) {
      setName(saved.name || '');
      setPhone(saved.phone || '');
      setShowSetup(true);
      return;
    }
    await triggerSilentSOS(country);
  }

  return (
    <>
      {/* FAB — fixed bottom right */}
      <div
        className="fixed z-40 flex flex-col items-end gap-2"
        style={{
          bottom: 'calc(24px + var(--safe-bottom))',
          right: 20,
        }}
      >
        {/* Contact label pill */}
        {contact.name && (
          <span
            style={{
              background: 'rgba(127, 29, 29, 0.1)',
              border: '1px solid rgba(184, 48, 37, 0.2)',
              borderRadius: 999,
              padding: '3px 10px',
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--critical)',
              maxWidth: 130,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            → {contact.name}
          </span>
        )}

        {/* The SOS FAB */}
        <button
          id="btn-silent-sos"
          onClick={handlePress}
          aria-label={t('silent_sos')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '14px 20px',
            background: 'linear-gradient(135deg, #7F1D1D 0%, #B83025 100%)',
            border: 'none',
            borderRadius: 999,
            cursor: 'pointer',
            boxShadow: pressed
              ? '0 2px 8px rgba(184, 48, 37, 0.3)'
              : '0 4px 20px rgba(184, 48, 37, 0.45), 0 2px 8px rgba(0,0,0,0.2)',
            animation: pressed ? 'none' : 'breathe 3s ease-in-out infinite',
            transform: pressed ? 'scale(0.93)' : 'scale(1)',
            transition: 'transform 0.12s ease, box-shadow 0.12s ease',
            WebkitTapHighlightColor: 'transparent',
            userSelect: 'none',
            minWidth: 100,
          }}
        >
          <ShieldAlert size={20} color="#fff" strokeWidth={2.5} />
          <span style={{
            fontSize: 14,
            fontWeight: 800,
            color: '#fff',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}>
            SOS
          </span>
        </button>
      </div>

      {/* Setup bottom sheet */}
      {showSetup && (
        <>
          <div className="bottom-sheet-backdrop" onClick={() => setShowSetup(false)} />
          <div className="bottom-sheet">
            <div className="bottom-sheet-handle" />

            <div className="flex items-center gap-3 mb-4">
              <div style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: 'var(--critical-bg)',
                border: '1px solid var(--critical-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Shield size={22} color="var(--critical)" />
              </div>
              <div>
                <div className="text-h3">{t('sos_setup_title')}</div>
                <p className="text-label" style={{ color: 'var(--text-secondary)', marginTop: 2 }}>
                  {t('sos_setup_subtitle')}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 mb-5">
              <input
                id="sos-setup-name"
                className="sr-input"
                placeholder={t('contact_name')}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <input
                id="sos-setup-phone"
                className="sr-input"
                type="tel"
                placeholder={t('contact_phone')}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            <div className="flex gap-3">
              <button
                id="btn-sos-setup-cancel"
                className="btn-outline flex-1"
                style={{ padding: '13px 16px' }}
                onClick={() => setShowSetup(false)}
              >
                {t('cancel')}
              </button>
              <button
                id="btn-sos-setup-save"
                className="btn-primary flex-1"
                style={{
                  padding: '13px 16px',
                  background: 'linear-gradient(135deg, #7F1D1D, #B83025)',
                  boxShadow: '0 4px 16px rgba(184,48,37,0.3)',
                }}
                onClick={handleSaveContact}
                disabled={!name.trim() || !phone.trim()}
              >
                {t('save_contact')}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
