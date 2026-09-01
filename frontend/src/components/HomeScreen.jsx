import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Activity,
  Settings,
  ShieldCheck,
  Map,
  Stethoscope,
  Building2,
  Users,
  ChevronRight,
} from 'lucide-react';

import SilentSOSButton from './SilentSOSButton';
import CrashAlert from './CrashAlert';

import {
  initCrashDetection,
  stopCrashDetection,
} from '../logic/crashDetection';

import {
  prewarmTiles,
  prewarmLocalArea,
  prewarmAllCountries,
} from '../logic/prewarmTiles';

import bimstecBounds from '../data/bimstec_bounds.json';
import emergencyNumbers from '../data/emergency_numbers.json';

export default function HomeScreen() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [country, setCountry] = useState(null);
  const [emergency, setEmergency] = useState(null);
  const [crashVisible, setCrashVisible] = useState(false);
  const [tileProgress, setTileProgress] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const voiceRef = useRef(null);

  useEffect(() => {
    const saved = localStorage.getItem('safereach_country');

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;

          const detected = detectCountry(
            latitude,
            longitude
          );

          loadCountry(
            detected || saved || 'BD',
            latitude,
            longitude
          );
        },
        () => loadCountry(saved || 'BD'),
        { timeout: 5000 }
      );
    } else {
      loadCountry(saved || 'BD');
    }
  }, []);

  function detectCountry(lat, lng) {
    for (const b of bimstecBounds) {
      if (
        lat >= b.min_lat &&
        lat <= b.max_lat &&
        lng >= b.min_lng &&
        lng <= b.max_lng
      ) {
        return b.country_code;
      }
    }

    return null;
  }

  async function loadCountry(
    code,
    lat = null,
    lng = null
  ) {
    const info =
      emergencyNumbers.find(
        (e) => e.country_code === code
      ) || emergencyNumbers[0];

    localStorage.setItem(
      'safereach_country',
      info.country_code
    );

    setCountry(info);
    setEmergency(info);

    if (navigator.onLine) {
      setTileProgress({
        fetched: 0,
        total: 1,
      });

      if (lat !== null && lng !== null) {
        await prewarmLocalArea(
          lat,
          lng,
          (fetched, total) => {
            setTileProgress({
              fetched,
              total: Math.max(total, 1),
            });
          }
        );
      }

      const bounds = bimstecBounds.find(
        (b) => b.country_code === info.country_code
      );

      if (bounds) {
        await prewarmTiles(
          bounds,
          (fetched, total) => {
            setTileProgress({
              fetched,
              total: Math.max(total, 1),
            });
          }
        );
      }

      setTileProgress(null);

      prewarmAllCountries().catch((error) => {
        console.warn(
          'Background prewarm failed:',
          error
        );
      });
    }
  }

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        const code =
          localStorage.getItem(
            'safereach_country'
          ) || 'BD';

        const info = emergencyNumbers.find(
          (e) => e.country_code === code
        );

        if (info) {
          setCountry(info);
          setEmergency(info);
        }
      }
    };

    document.addEventListener(
      'visibilitychange',
      handleVisibility
    );

    return () =>
      document.removeEventListener(
        'visibilitychange',
        handleVisibility
      );
  }, []);

  useEffect(() => {
    const crashEnabled =
      localStorage.getItem(
        'crash_detection_enabled'
      ) !== 'false';

    const sensitivity =
      localStorage.getItem(
        'crash_sensitivity'
      ) || 'medium';

    if (crashEnabled) {
      initCrashDetection(
        () => setCrashVisible(true),
        {
          sensitivity,
          enabled: true,
        }
      );
    }

    return () => stopCrashDetection();
  }, []);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);

    window.addEventListener(
      'online',
      onOnline
    );

    window.addEventListener(
      'offline',
      onOffline
    );

    return () => {
      window.removeEventListener(
        'online',
        onOnline
      );

      window.removeEventListener(
        'offline',
        onOffline
      );
    };
  }, []);

  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    if (!SpeechRecognition) return;

    try {
      const recognition =
        new SpeechRecognition();

      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event) => {
        for (
          let i = event.resultIndex;
          i < event.results.length;
          i++
        ) {
          const text =
            event.results[i][0].transcript.toLowerCase();

          if (text.includes('safereach')) {
            navigate('/triage');
          }
        }
      };

      recognition.onerror = () => {};

      recognition.start();
      voiceRef.current = recognition;
    } catch {}

    return () =>
      voiceRef.current?.stop();
  }, [navigate]);

  function handleCrashCancel() {
    setCrashVisible(false);

    setTimeout(() => {
      initCrashDetection(
        () => setCrashVisible(true),
        {
          sensitivity:
            localStorage.getItem(
              'crash_sensitivity'
            ) || 'medium',
        }
      );
    }, 1000);
  }

  return (
    <>
      {crashVisible && (
        <CrashAlert
          country={country}
          onCancel={handleCrashCancel}
          onSOS={() => setCrashVisible(false)}
        />
      )}

      <div
        className="screen"
        style={{
          background: 'var(--bg-primary)',
          minHeight: '100vh',
        }}
      >
        {/* Top bar */}
        <header className="topbar">
          <div className="flex items-center gap-2.5">
            {country && (
              <>
                <span
                  className="text-2xl"
                  role="img"
                  aria-label={country.country_name}
                >
                  {country.flag}
                </span>

                <div>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                      lineHeight: 1.2,
                    }}
                  >
                    {country.country_name}
                  </div>

                  <div
                    className="text-micro"
                    style={{ marginTop: 1 }}
                  >
                    {t('auto_detected')}
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="offline-pill">
              {t('offline_ready')}
            </span>

            <button
              onClick={() =>
                navigate('/settings')
              }
              className="touch-target flex items-center justify-center"
              style={{
                width: 38,
                height: 38,
                background:
                  'var(--bg-elevated)',
                border:
                  '1px solid var(--border)',
                borderRadius: '50%',
                cursor: 'pointer',
                boxShadow: 'var(--shadow-xs)',
              }}
              aria-label="Settings"
              id="btn-settings"
            >
              <Settings
                size={18}
                color="var(--text-secondary)"
              />
            </button>
          </div>
        </header>

        {/* Map download progress */}
        {tileProgress && (
          <div
            className="flex items-center gap-3 px-5 py-2.5"
            style={{
              background: 'var(--stable-bg)',
              borderBottom:
                '1px solid var(--stable-border)',
            }}
          >
            <div
              className="flex-1 sr-progress-track"
              style={{ height: 4 }}
            >
              <div
                className="sr-progress-fill"
                style={{
                  width: `${Math.round(
                    (tileProgress.fetched /
                      tileProgress.total) *
                      100
                  )}%`,
                }}
              />
            </div>

            <span
              className="text-label"
              style={{
                color: 'var(--stable)',
                flexShrink: 0,
              }}
            >
              {t('downloading_map')}
            </span>
          </div>
        )}

        {/* Main content */}
        <main
          className="flex-1 flex flex-col px-5 pt-7"
          style={{
            gap: 16,
            paddingBottom: 24,
          }}
        >
          {/* Hero */}
          <div className="flex flex-col gap-4">
            <div className="hero-beacon">
              <Activity
                size={38}
                color="var(--accent)"
                strokeWidth={2}
              />
            </div>

            <div>
              <h1
                className="text-h1"
                style={{ marginBottom: 6 }}
              >
                SafeReach
              </h1>

              <p
                className="text-body"
                style={{
                  color:
                    'var(--text-secondary)',
                  maxWidth: 280,
                }}
              >
                {t('tap_for_emergency')}
              </p>
            </div>
          </div>

          {/* Primary guided emergency action */}
          <button
            id="btn-find-help"
            className="btn-primary"
            style={{
              paddingTop: 18,
              paddingBottom: 18,
              borderRadius: 18,
              fontSize: 17,
              gap: 10,
              boxShadow:
                '0 8px 24px rgba(40, 86, 132, 0.22)',
            }}
            onClick={() =>
              navigate('/triage')
            }
          >
            <ShieldCheck
              size={22}
              strokeWidth={2.5}
            />

            {t('emergency_button')}
          </button>

          {/* Emergency quick calls */}
          {emergency && (
            <section
              className="call-card"
              style={{
                paddingBottom: 18,
              }}
            >
              <div
                className="text-micro mb-4"
                style={{
                  color:
                    'rgba(255,255,255,0.45)',
                  letterSpacing: '0.08em',
                }}
              >
                {t('emergency_numbers')} ·{' '}
                {emergency.country_name}
              </div>

              <div className="flex gap-3">
                <QuickCallButton
                  label={t('police')}
                  number={emergency.police}
                  emoji="👮"
                  id="btn-call-police"
                />

                <QuickCallButton
                  label={t('ambulance')}
                  number={emergency.ambulance}
                  emoji="🚑"
                  id="btn-call-ambulance"
                />

                <QuickCallButton
                  label={t('hospital')}
                  number={emergency.unified}
                  emoji="🏥"
                  id="btn-call-hospital"
                />
              </div>
            </section>
          )}

          {/* Quick access */}
          <section>
            <div
              className="text-micro"
              style={{
                color: 'var(--text-tertiary)',
                letterSpacing: '0.08em',
                marginBottom: 10,
                fontWeight: 700,
              }}
            >
              QUICK ACCESS
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  'repeat(2, minmax(0, 1fr))',
                gap: 10,
              }}
            >
              <QuickAccessCard
                label="Map"
                description="Nearby facilities"
                icon={<Map size={19} />}
                onClick={() =>
                  navigate('/map')
                }
                id="btn-nav-map"
              />

              <QuickAccessCard
                label="Active Region"
                description="Change country"
                icon={<Building2 size={19} />}
                onClick={() =>
                  navigate('/countries')
                }
                id="btn-nav-countries"
              />

              <QuickAccessCard
                label="First Aid"
                description="Emergency guidance"
                icon={<Stethoscope size={19} />}
                onClick={() =>
                  navigate(
                    '/firstaid/minor_injury'
                  )
                }
                id="btn-nav-firstaid"
              />

              <QuickAccessCard
                label="Contacts"
                description="Emergency contacts"
                icon={<Users size={19} />}
                onClick={() =>
                  navigate(
                    '/emergency-contacts'
                  )
                }
                id="btn-nav-emergency-contacts"
              />
            </div>
          </section>

          {/* Primary SOS action — directly after Quick Access */}
          <SilentSOSButton country={country} />

          {/* Offline mode */}
          {!isOnline && (
            <div
              className="flex items-center gap-3 rounded-2xl p-4"
              style={{
                background:
                  'var(--stable-bg)',
                border:
                  '1px solid var(--stable-border)',
                animation:
                  'scaleIn 0.2s ease',
              }}
            >
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 11,
                  background:
                    'var(--stable-bg)',
                  border:
                    '1px solid var(--stable-border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <ShieldCheck
                  size={19}
                  color="var(--stable)"
                />
              </div>

              <div>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color:
                      'var(--stable-text)',
                    lineHeight: 1.2,
                  }}
                >
                  Offline Mode Active
                </div>

                <div
                  className="text-label"
                  style={{ marginTop: 2 }}
                >
                  All essential features remain available
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  );
}

function QuickCallButton({
  label,
  number,
  emoji,
  id,
}) {
  return (
    <a
      id={id}
      href={`tel:${number}`}
      className="call-btn"
      style={{
        position: 'relative',
        overflow: 'hidden',
        paddingBottom: '30px',
      }}
    >
      <span
        style={{
          fontSize: 24,
          marginTop: 4,
        }}
      >
        {emoji}
      </span>

      <span
        style={{
          fontSize: 18,
          fontWeight: 800,
          color: '#FFFFFF',
          fontVariantNumeric:
            'tabular-nums',
          letterSpacing: '-0.01em',
          lineHeight: 1,
          marginTop: 2,
        }}
      >
        {number}
      </span>

      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          color:
            'rgba(255,255,255,0.55)',
          textAlign: 'center',
          marginBottom: 2,
        }}
      >
        {label}
      </span>

      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          background: 'var(--stable)',
          color: '#fff',
          fontSize: '9.5px',
          fontWeight: 800,
          textAlign: 'center',
          padding: '5px 0',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '3px',
        }}
      >
        <span>📞</span>
        Tap to Call
      </div>
    </a>
  );
}

function QuickAccessCard({
  label,
  description,
  icon,
  onClick,
  id,
}) {
  return (
    <button
      id={id}
      onClick={onClick}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 11,
        padding: '13px 12px',
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        borderRadius: 15,
        cursor: 'pointer',
        textAlign: 'left',
        boxShadow: 'var(--shadow-xs)',
        transition:
          'transform 0.15s ease, box-shadow 0.15s ease',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: 11,
          background: 'var(--accent-soft)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--accent)',
          flexShrink: 0,
        }}
      >
        {icon}
      </div>

      <div
        style={{
          minWidth: 0,
          flex: 1,
        }}
      >
        <div
          style={{
            fontSize: 13,
            fontWeight: 750,
            color: 'var(--text-primary)',
            lineHeight: 1.2,
          }}
        >
          {label}
        </div>

        <div
          style={{
            fontSize: 10,
            color: 'var(--text-tertiary)',
            marginTop: 3,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {description}
        </div>
      </div>

      <ChevronRight
        size={15}
        color="var(--text-tertiary)"
        strokeWidth={2}
      />
    </button>
  );
}