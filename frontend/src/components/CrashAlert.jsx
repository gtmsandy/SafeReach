import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { triggerSilentSOS } from '../logic/silentSOS';
import { stopCrashDetection } from '../logic/crashDetection';

const COUNTDOWN_SECONDS = 15;
const RING_CIRCUMFERENCE = 283;

export default function CrashAlert({ country, onCancel, onSOS }) {
  const { t } = useTranslation();
  const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_SECONDS);
  const firedRef = useRef(false);

  useEffect(() => {
    stopCrashDetection();
  }, []);

  useEffect(() => {
    if (secondsLeft <= 0) {
      if (!firedRef.current) {
        firedRef.current = true;
        triggerSilentSOS(country).then(() => onSOS?.());
      }
      return;
    }
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft, country, onSOS]);

  async function handleGetHelp() {
    if (firedRef.current) return;
    firedRef.current = true;
    await triggerSilentSOS(country);
    onSOS?.();
  }

  const ringProgress = (COUNTDOWN_SECONDS - secondsLeft) / COUNTDOWN_SECONDS;
  // Color shifts from amber → red as countdown drops below 5s
  const isUrgent = secondsLeft <= 5;
  const ringColor = isUrgent ? '#EF4444' : '#F59E0B';

  return (
    <div
      className="crash-overlay"
      id="crash-alert-overlay"
    >
      <div
        style={{
          maxWidth: 360,
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: 28,
        }}
      >
        {/* Detected label */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            background: 'rgba(245, 158, 11, 0.12)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            borderRadius: 999,
            padding: '6px 14px',
          }}
        >
          <div style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: '#F59E0B',
            animation: 'pulseDot 1.2s ease-in-out infinite',
          }} />
          <span style={{
            fontSize: 12,
            fontWeight: 700,
            color: '#F59E0B',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}>
            {t('crash_detected')}
          </span>
        </div>

        {/* Headline */}
        <div>
          <h1
            style={{
              fontSize: 34,
              fontWeight: 800,
              color: '#FFFFFF',
              lineHeight: 1.15,
              letterSpacing: '-0.025em',
              marginBottom: 12,
            }}
          >
            {t('are_you_ok')}
          </h1>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>
            {t('auto_sos_in', { seconds: secondsLeft })}
          </p>
        </div>

        {/* Countdown ring + Get Help button */}
        <div className="relative" style={{ width: 160, height: 160 }}>
          {/* Outer glow ring */}
          <svg
            width={160}
            height={160}
            style={{ position: 'absolute', inset: 0 }}
          >
            {/* Track */}
            <circle
              cx={80}
              cy={80}
              r={70}
              fill="none"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth={6}
            />
            {/* Countdown fill */}
            <circle
              cx={80}
              cy={80}
              r={70}
              fill="none"
              stroke={ringColor}
              strokeWidth={6}
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 70}
              strokeDashoffset={(2 * Math.PI * 70) * (1 - ringProgress)}
              transform="rotate(-90 80 80)"
              style={{
                transition: 'stroke-dashoffset 1s linear, stroke 0.5s ease',
                filter: `drop-shadow(0 0 8px ${ringColor}66)`,
              }}
            />
          </svg>

          {/* Center button */}
          <button
            id="btn-crash-get-help"
            onClick={handleGetHelp}
            style={{
              position: 'absolute',
              inset: 16,
              borderRadius: '50%',
              background: isUrgent
                ? 'linear-gradient(135deg, #7F1D1D, #DC2626)'
                : 'linear-gradient(135deg, #1B3A5C, #2563A8)',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              boxShadow: isUrgent
                ? '0 0 32px rgba(220, 38, 38, 0.4)'
                : '0 0 24px rgba(37, 99, 168, 0.4)',
              transition: 'background 0.5s ease, box-shadow 0.5s ease',
              animation: 'countdownPulse 2s ease-in-out infinite',
            }}
          >
            <span style={{
              fontSize: 36,
              fontWeight: 800,
              color: '#FFFFFF',
              lineHeight: 1,
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: '-0.02em',
            }}>
              {secondsLeft}
            </span>
            <span style={{
              fontSize: 11,
              fontWeight: 700,
              color: 'rgba(255,255,255,0.8)',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}>
              {t('get_help')}
            </span>
          </button>
        </div>

        {/* I'm Fine button */}
        <button
          id="btn-crash-im-fine"
          onClick={onCancel}
          style={{
            padding: '16px 40px',
            background: 'rgba(31, 122, 84, 0.15)',
            border: '1.5px solid rgba(31, 122, 84, 0.4)',
            borderRadius: 999,
            fontSize: 16,
            fontWeight: 700,
            color: '#4ADE80',
            cursor: 'pointer',
            letterSpacing: '-0.01em',
            transition: 'all 0.15s',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          ✓ {t('im_fine')}
        </button>

        {/* Helper text */}
        <p style={{
          fontSize: 12,
          color: 'rgba(255,255,255,0.25)',
          lineHeight: 1.5,
          maxWidth: 260,
        }}>
          Tap "Get Help" to immediately call emergency services and send your location to your emergency contact.
        </p>
      </div>
    </div>
  );
}
