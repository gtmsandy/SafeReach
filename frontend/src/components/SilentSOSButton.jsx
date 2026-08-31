import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldAlert, Shield, AlertTriangle, Phone } from 'lucide-react';
import { triggerSilentSOS } from '../logic/silentSOS';

function getSavedContact() {
  try {
    return JSON.parse(localStorage.getItem('sos_contact') || '{}');
  } catch {
    return {};
  }
}

export default function SilentSOSButton({ country }) {
  const { t } = useTranslation();

  const [showSetup, setShowSetup] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [contact, setContact] = useState(getSavedContact);
  const [pressed, setPressed] = useState(false);

  useEffect(() => {
    function handleContactUpdate() {
      setContact(getSavedContact());
    }

    window.addEventListener(
      'sos_contact_updated',
      handleContactUpdate
    );

    window.addEventListener(
      'storage',
      handleContactUpdate
    );

    return () => {
      window.removeEventListener(
        'sos_contact_updated',
        handleContactUpdate
      );

      window.removeEventListener(
        'storage',
        handleContactUpdate
      );
    };
  }, []);

  function handleSaveContact() {
    if (!name.trim() || !phone.trim()) return;

    const saved = {
      name: name.trim(),
      phone: phone.trim(),
    };

    localStorage.setItem(
      'sos_contact',
      JSON.stringify(saved)
    );

    setContact(saved);

    window.dispatchEvent(
      new Event('sos_contact_updated')
    );

    setShowSetup(false);

    triggerSilentSOS(country);
  }

  async function handlePress() {
    setPressed(true);

    setTimeout(() => {
      setPressed(false);
    }, 180);

    const saved = getSavedContact();

    if (!saved.phone) {
      setName(saved.name || '');
      setPhone(saved.phone || '');
      setShowSetup(true);
      return;
    }

    await triggerSilentSOS(country);
  }

  function handleCloseSetup() {
    setShowSetup(false);
    setName('');
    setPhone('');
  }

  return (
    <>
      {/* Primary SOS Section - Normal document flow */}
      <div
        style={{
          width: '100%',
          marginTop: 14,
          paddingBottom: 20,
        }}
      >
        {/* Emergency Contact Status */}
        {contact.name ? (
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              marginBottom: 10,
            }}
          >
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                padding: '6px 13px',
                borderRadius: 999,
                background: 'rgba(34, 197, 94, 0.08)',
                border: '1px solid rgba(34, 197, 94, 0.25)',
                fontSize: 10,
                fontWeight: 700,
                color: 'var(--text-secondary)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: '#22c55e',
                  flexShrink: 0,
                }}
              />

              <span>
                Emergency contact ready:
              </span>

              <strong
                style={{
                  color: 'var(--critical)',
                }}
              >
                {contact.name}
              </strong>
            </div>
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              marginBottom: 10,
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: 'var(--text-secondary)',
                padding: '6px 12px',
                borderRadius: 999,
                background: 'var(--surface)',
                border: '1px solid var(--border)',
              }}
            >
              Set an emergency contact for SOS alerts
            </div>
          </div>
        )}

        {/* Main SOS Button */}
        <button
          id="btn-silent-sos"
          onClick={handlePress}
          aria-label={t('silent_sos')}
          style={{
            width: '100%',
            minHeight: 64,

            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',

            padding: '10px 18px',

            border: 'none',
            borderRadius: 18,

            background:
              'linear-gradient(135deg, #991B1B 0%, #DC2626 55%, #B91C1C 100%)',

            cursor: 'pointer',

            boxShadow: pressed
              ? '0 3px 10px rgba(153, 27, 27, 0.3)'
              : '0 7px 22px rgba(185, 28, 28, 0.32)',

            transform: pressed
              ? 'scale(0.985)'
              : 'scale(1)',

            transition:
              'transform 0.15s ease, box-shadow 0.15s ease',

            WebkitTapHighlightColor: 'transparent',
            userSelect: 'none',
          }}
        >
          {/* Left Icon */}
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 13,

              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',

              background: 'rgba(255,255,255,0.15)',
              border: '1px solid rgba(255,255,255,0.22)',
            }}
          >
            <ShieldAlert
              size={23}
              color="#fff"
              strokeWidth={2.5}
            />
          </div>

          {/* SOS Text */}
          <div
            style={{
              flex: 1,
              textAlign: 'left',
              marginLeft: 12,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
              }}
            >
              <span
                style={{
                  fontSize: 19,
                  fontWeight: 900,
                  letterSpacing: '0.08em',
                  color: '#fff',
                  lineHeight: 1,
                }}
              >
                SOS
              </span>

              <span
                style={{
                  fontSize: 9,
                  fontWeight: 800,
                  letterSpacing: '0.08em',
                  padding: '3px 6px',
                  borderRadius: 5,
                  background: 'rgba(255,255,255,0.18)',
                  color: '#fff',
                }}
              >
                EMERGENCY
              </span>
            </div>

            <div
              style={{
                marginTop: 5,
                fontSize: 10,
                fontWeight: 600,
                color: 'rgba(255,255,255,0.85)',
              }}
            >
              Trigger emergency assistance
            </div>
          </div>

          {/* Right phone indicator */}
          <div
            style={{
              width: 34,
              height: 34,

              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',

              borderRadius: '50%',
              background: 'rgba(255,255,255,0.12)',
            }}
          >
            <Phone
              size={17}
              color="#fff"
              strokeWidth={2.4}
            />
          </div>
        </button>
      </div>

      {/* Emergency Contact Setup Bottom Sheet */}
      {showSetup && (
        <>
          <div
            className="bottom-sheet-backdrop"
            onClick={handleCloseSetup}
          />

          <div className="bottom-sheet">
            <div className="bottom-sheet-handle" />

            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 14,
                  background: 'var(--critical-bg)',
                  border:
                    '1px solid var(--critical-border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <AlertTriangle
                  size={24}
                  color="var(--critical)"
                />
              </div>

              <div>
                <div className="text-h3">
                  {t('sos_setup_title')}
                </div>

                <p
                  className="text-label"
                  style={{
                    color: 'var(--text-secondary)',
                    marginTop: 3,
                  }}
                >
                  {t('sos_setup_subtitle')}
                </p>
              </div>
            </div>

            {/* Explanation */}
            <div
              style={{
                padding: '11px 13px',
                marginBottom: 16,
                borderRadius: 12,
                background: 'var(--critical-bg)',
                border:
                  '1px solid var(--critical-border)',
                fontSize: 12,
                lineHeight: 1.5,
                color: 'var(--text-secondary)',
              }}
            >
              Your emergency contact will receive an SMS with
              your location after emergency assistance is
              triggered.
            </div>

            {/* Contact Inputs */}
            <div className="flex flex-col gap-3 mb-5">
              <input
                id="sos-setup-name"
                className="sr-input"
                placeholder={t('contact_name')}
                value={name}
                onChange={(e) =>
                  setName(e.target.value)
                }
              />

              <input
                id="sos-setup-phone"
                className="sr-input"
                type="tel"
                placeholder={t('contact_phone')}
                value={phone}
                onChange={(e) =>
                  setPhone(e.target.value)
                }
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                id="btn-sos-setup-cancel"
                className="btn-outline flex-1"
                style={{
                  padding: '13px 16px',
                }}
                onClick={handleCloseSetup}
              >
                {t('cancel')}
              </button>

              <button
                id="btn-sos-setup-save"
                className="btn-primary flex-1"
                style={{
                  padding: '13px 16px',
                  background:
                    'linear-gradient(135deg, #7F1D1D, #DC2626)',
                  boxShadow:
                    '0 5px 16px rgba(185,28,28,0.28)',
                }}
                onClick={handleSaveContact}
                disabled={
                  !name.trim() ||
                  !phone.trim()
                }
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