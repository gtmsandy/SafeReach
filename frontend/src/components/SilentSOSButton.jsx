import {
  useEffect,
  useRef,
  useState,
} from 'react';

import { useTranslation } from 'react-i18next';

import {
  ShieldAlert,
  Shield,
  AlertTriangle,
  Phone,
} from 'lucide-react';

import {
  triggerSilentSOS,
} from '../logic/silentSOS';

function getSavedContact() {
  try {
    return JSON.parse(
      localStorage.getItem('sos_contact') || '{}'
    );
  } catch {
    return {};
  }
}

export default function SilentSOSButton({
  country,
}) {
  const { t } = useTranslation();

  const [showSetup, setShowSetup] =
    useState(false);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  const [contact, setContact] =
    useState(getSavedContact);

  const [holdProgress, setHoldProgress] =
    useState(0);

  const [isHolding, setIsHolding] =
    useState(false);

  const holdStartRef = useRef(null);
  const animationRef = useRef(null);
  const triggeredRef = useRef(false);

  const HOLD_DURATION = 3000;

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

      if (animationRef.current) {
        cancelAnimationFrame(
          animationRef.current
        );
      }
    };
  }, []);

  function handleSaveContact() {
    if (!name.trim() || !phone.trim()) {
      return;
    }

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

  async function completeSOS() {
    if (triggeredRef.current) return;

    triggeredRef.current = true;

    setIsHolding(false);
    setHoldProgress(100);

    const saved = getSavedContact();

    if (!saved.phone) {
      setName(saved.name || '');
      setPhone(saved.phone || '');
      setShowSetup(true);

      setTimeout(() => {
        triggeredRef.current = false;
        setHoldProgress(0);
      }, 300);

      return;
    }

    await triggerSilentSOS(country);

    setTimeout(() => {
      triggeredRef.current = false;
      setHoldProgress(0);
    }, 600);
  }

  function updateHoldProgress(timestamp) {
    if (!holdStartRef.current) {
      return;
    }

    const elapsed =
      timestamp - holdStartRef.current;

    const progress = Math.min(
      (elapsed / HOLD_DURATION) * 100,
      100
    );

    setHoldProgress(progress);

    if (progress >= 100) {
      completeSOS();
      return;
    }

    animationRef.current =
      requestAnimationFrame(
        updateHoldProgress
      );
  }

  function startHold(event) {
    event.preventDefault();

    if (isHolding || triggeredRef.current) {
      return;
    }

    setIsHolding(true);
    setHoldProgress(0);

    holdStartRef.current =
      performance.now();

    animationRef.current =
      requestAnimationFrame(
        updateHoldProgress
      );
  }

  function cancelHold() {
    if (triggeredRef.current) {
      return;
    }

    if (animationRef.current) {
      cancelAnimationFrame(
        animationRef.current
      );
    }

    holdStartRef.current = null;

    setIsHolding(false);
    setHoldProgress(0);
  }

  function handleKeyDown(event) {
    if (
      event.key === 'Enter' ||
      event.key === ' '
    ) {
      if (!event.repeat) {
        startHold(event);
      }
    }
  }

  function handleKeyUp(event) {
    if (
      event.key === 'Enter' ||
      event.key === ' '
    ) {
      cancelHold();
    }
  }

  function handleCloseSetup() {
    setShowSetup(false);
    setName('');
    setPhone('');
    setHoldProgress(0);
    setIsHolding(false);
  }

  return (
    <>
      {/* SOS Section */}
      <section
        style={{
          width: '100%',
          paddingBottom: 4,
        }}
      >
        {/* Contact status directly above SOS */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            marginBottom: 9,
          }}
        >
          {contact.name ? (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                padding: '6px 12px',
                borderRadius: 999,
                background:
                  'rgba(34, 197, 94, 0.08)',
                border:
                  '1px solid rgba(34, 197, 94, 0.25)',
                fontSize: 10,
                fontWeight: 700,
                color: 'var(--text-secondary)',
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: '#22C55E',
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
          ) : (
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: 'var(--text-secondary)',
                padding: '6px 12px',
                borderRadius: 999,
                background:
                  'var(--bg-elevated)',
                border:
                  '1px solid var(--border)',
              }}
            >
              Hold SOS to set emergency contact
            </div>
          )}
        </div>

        {/* SOS Button */}
        <button
          id="btn-silent-sos"
          type="button"
          aria-label={t('silent_sos')}
          aria-describedby="sos-instruction"
          onPointerDown={startHold}
          onPointerUp={cancelHold}
          onPointerLeave={cancelHold}
          onPointerCancel={cancelHold}
          onKeyDown={handleKeyDown}
          onKeyUp={handleKeyUp}
          style={{
            width: '100%',
            minHeight: 70,

            position: 'relative',
            overflow: 'hidden',

            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',

            padding: '11px 17px',

            border:
              isHolding
                ? '2px solid #FFFFFF'
                : '1px solid rgba(255,255,255,0.22)',

            borderRadius: 18,

            background:
              'linear-gradient(135deg, #991B1B 0%, #DC2626 52%, #B91C1C 100%)',

            cursor: 'pointer',

            boxShadow: isHolding
              ? '0 8px 28px rgba(185,28,28,0.50)'
              : '0 6px 18px rgba(185,28,28,0.30)',

            transform: isHolding
              ? 'scale(0.985)'
              : 'scale(1)',

            transition:
              'transform 0.15s ease, box-shadow 0.15s ease',

            WebkitTapHighlightColor:
              'transparent',

            touchAction: 'none',
            userSelect: 'none',
          }}
        >
          {/* Hold progress */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              width: `${holdProgress}%`,
              background:
                'rgba(255,255,255,0.18)',
              transition: isHolding
                ? 'none'
                : 'width 0.15s ease',
              pointerEvents: 'none',
            }}
          />

          {/* Left Icon */}
          <div
            style={{
              position: 'relative',
              zIndex: 1,

              width: 45,
              height: 45,

              borderRadius: 14,

              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',

              background:
                'rgba(255,255,255,0.15)',

              border:
                '1px solid rgba(255,255,255,0.25)',

              flexShrink: 0,
            }}
          >
            <ShieldAlert
              size={24}
              color="#FFFFFF"
              strokeWidth={2.6}
            />
          </div>

          {/* SOS Content */}
          <div
            style={{
              position: 'relative',
              zIndex: 1,

              flex: 1,
              textAlign: 'left',
              marginLeft: 12,
              minWidth: 0,
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
                  color: '#FFFFFF',
                  lineHeight: 1,
                }}
              >
                SOS
              </span>

              <span
                style={{
                  fontSize: 9,
                  fontWeight: 850,
                  letterSpacing: '0.07em',
                  padding: '3px 6px',
                  borderRadius: 5,
                  background:
                    'rgba(255,255,255,0.18)',
                  color: '#FFFFFF',
                }}
              >
                EMERGENCY
              </span>
            </div>

            <div
              id="sos-instruction"
              style={{
                marginTop: 5,
                fontSize: 10,
                fontWeight: 650,
                color:
                  'rgba(255,255,255,0.92)',
              }}
            >
              {isHolding
                ? `Keep holding... ${Math.ceil(
                    (HOLD_DURATION / 1000) *
                      (1 -
                        holdProgress / 100)
                  )}s`
                : 'Hold for 3 seconds to trigger'}
            </div>
          </div>

          {/* Right indicator */}
          <div
            style={{
              position: 'relative',
              zIndex: 1,

              width: 36,
              height: 36,

              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',

              borderRadius: '50%',

              background:
                'rgba(255,255,255,0.13)',

              flexShrink: 0,
            }}
          >
            <Phone
              size={17}
              color="#FFFFFF"
              strokeWidth={2.5}
            />
          </div>
        </button>
      </section>

      {/* Emergency Contact Setup */}
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
                  background:
                    'var(--critical-bg)',
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
                    color:
                      'var(--text-secondary)',
                    marginTop: 3,
                  }}
                >
                  {t('sos_setup_subtitle')}
                </p>
              </div>
            </div>

            {/* Information */}
            <div
              style={{
                padding: '11px 13px',
                marginBottom: 16,
                borderRadius: 12,
                background:
                  'var(--critical-bg)',
                border:
                  '1px solid var(--critical-border)',
                fontSize: 12,
                lineHeight: 1.5,
                color:
                  'var(--text-secondary)',
              }}
            >
              Your emergency contact will receive an SMS
              with your location after emergency
              assistance is triggered.
            </div>

            {/* Inputs */}
            <div className="flex flex-col gap-3 mb-5">
              <input
                id="sos-setup-name"
                className="sr-input"
                placeholder={t('contact_name')}
                value={name}
                onChange={(event) =>
                  setName(event.target.value)
                }
              />

              <input
                id="sos-setup-phone"
                className="sr-input"
                type="tel"
                placeholder={t('contact_phone')}
                value={phone}
                onChange={(event) =>
                  setPhone(event.target.value)
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