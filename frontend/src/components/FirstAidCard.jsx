import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ChevronLeft,
  AlertTriangle,
  Stethoscope,
} from 'lucide-react';

import firstAidData from '../data/first_aid_protocols.json';
import { LANGUAGES } from '../i18n/index.js';

const ICON_MAP = {
  phone: '📞',
  warning: '⚠️',
  airway: '🫁',
  cpr: '💪',
  continue: '🔄',
  pressure: '🤚',
  warmth: '🧣',
  talk: '🗣️',
  fracture: '🦴',
  monitor: '👁️',
  move: '🚶',
  clean: '💧',
  bandage: '🩹',
  hospital: '🏥',
};

const SEVERITY_STYLE = {
  critical: {
    color: 'var(--critical)',
    bg: 'var(--critical-bg)',
    border: 'var(--critical-border)',
    label: 'CRITICAL',
  },
  serious: {
    color: 'var(--serious)',
    bg: 'var(--serious-bg)',
    border: 'var(--serious-border)',
    label: 'SERIOUS',
  },
  stable: {
    color: 'var(--stable)',
    bg: 'var(--stable-bg)',
    border: 'var(--stable-border)',
    label: 'STABLE',
  },
};

const PROTOCOL_TITLES = {
  cpr_needed: 'CPR — Not Breathing',
  critical_trauma: 'Critical Trauma',
  serious_trauma: 'Serious Trauma',
  minor_injury: 'Minor Injury',
};

const PROTOCOL_META = {
  cpr_needed: {
    emoji: '💪',
    label: 'CPR',
  },
  critical_trauma: {
    emoji: '🩸',
    label: 'Severe Bleeding',
  },
  serious_trauma: {
    emoji: '🦴',
    label: 'Fracture / Trauma',
  },
  minor_injury: {
    emoji: '🩹',
    label: 'Minor Injury',
  },
};

export default function FirstAidCard() {
  const { protocolId } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const [lang, setLang] = useState(
    i18n.language?.split('-')[0] || 'en'
  );

  const [protocol, setProtocol] = useState(null);

  useEffect(() => {
    const found = firstAidData.find(
      (p) => p.id === protocolId
    );

    setProtocol(found || null);
  }, [protocolId]);

  if (!protocol) {
    return (
      <div
        className="screen"
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          className="text-label"
          style={{
            color: 'var(--text-tertiary)',
          }}
        >
          Protocol not found
        </div>
      </div>
    );
  }

  const sev =
    SEVERITY_STYLE[protocol.severity] ||
    SEVERITY_STYLE.stable;

  const title =
    PROTOCOL_TITLES[protocol.id] ||
    protocol.id.replace(/_/g, ' ');

  function getStepText(step) {
    const supportedLangs = [
      'en',
      'bn',
      'th',
      'ne',
    ];

    const activeLang = supportedLangs.includes(lang)
      ? lang
      : 'en';

    return step[activeLang] || step.en;
  }

  const availableLangs = LANGUAGES.filter((l) => {
    if (l.code === 'en') return true;

    return protocol.steps.some(
      (step) => step[l.code]
    );
  });

  return (
    <div
      className="screen"
      style={{
        minHeight: '100vh',
        background: 'var(--bg-primary)',
      }}
    >
      {/* ───────────────── Header ───────────────── */}

      <header className="topbar">
        <button
          id="btn-firstaid-back"
          onClick={() => navigate(-1)}
          className="touch-target"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          aria-label="Go back"
        >
          <ChevronLeft size={24} />
        </button>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Stethoscope
            size={18}
            color="var(--accent)"
          />

          <span className="text-h4">
            {t('first_aid_guide')}
          </span>
        </div>

        <div style={{ width: 40 }} />
      </header>

      {/* ───────────────── Main Content ───────────────── */}

      <main
        style={{
          width: '100%',
          maxWidth: 760,
          margin: '0 auto',
          padding:
            '20px 20px calc(48px + var(--safe-bottom))',
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        }}
      >
        {/* ───────────────── Protocol Selector ───────────────── */}

        <section>
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: '0.1em',
              color: 'var(--text-tertiary)',
              marginBottom: 10,
            }}
          >
            FIRST AID PROTOCOLS
          </div>

          <div
            style={{
              display: 'flex',
              gap: 8,
              overflowX: 'auto',
              paddingBottom: 4,
              scrollbarWidth: 'none',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            {firstAidData.map((proto) => {
              const isActive =
                proto.id === protocolId;

              const meta =
                PROTOCOL_META[proto.id] || {
                  emoji: '🩺',
                  label: proto.id,
                };

              return (
                <button
                  key={proto.id}
                  id={`btn-select-proto-${proto.id}`}
                  onClick={() =>
                    navigate(
                      `/firstaid/${proto.id}`
                    )
                  }
                  style={{
                    flexShrink: 0,

                    display: 'flex',
                    alignItems: 'center',
                    gap: 7,

                    padding: '10px 14px',

                    borderRadius: 12,

                    background: isActive
                      ? 'var(--accent)'
                      : 'var(--bg-card)',

                    color: isActive
                      ? '#fff'
                      : 'var(--text-secondary)',

                    border: isActive
                      ? '1px solid var(--accent)'
                      : '1px solid var(--border)',

                    fontSize: 12,
                    fontWeight: 700,

                    cursor: 'pointer',

                    boxShadow: isActive
                      ? '0 4px 12px rgba(0,0,0,0.12)'
                      : 'none',

                    transition:
                      'all 0.15s ease',
                  }}
                >
                  <span
                    style={{
                      fontSize: 16,
                    }}
                  >
                    {meta.emoji}
                  </span>

                  <span>{meta.label}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* ───────────────── Protocol Header ───────────────── */}

        <section
          style={{
            background: sev.bg,

            border:
              `1px solid ${sev.border}`,

            borderRadius: 18,

            overflow: 'hidden',

            boxShadow:
              '0 4px 16px rgba(0,0,0,0.06)',
          }}
        >
          {/* Severity strip */}

          <div
            style={{
              height: 5,
              background: sev.color,
            }}
          />

          <div
            style={{
              padding: '18px',

              display: 'flex',
              alignItems: 'center',
              gap: 14,
            }}
          >
            <div
              style={{
                width: 54,
                height: 54,

                flexShrink: 0,

                borderRadius: 16,

                background: sev.color,

                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',

                boxShadow:
                  '0 4px 12px rgba(0,0,0,0.12)',
              }}
            >
              <span
                style={{
                  fontSize: 26,
                }}
              >
                {PROTOCOL_META[protocol.id]
                  ?.emoji || '🩺'}
              </span>
            </div>

            <div
              style={{
                minWidth: 0,
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: '0.12em',

                  color: sev.color,

                  marginBottom: 5,
                }}
              >
                {sev.label} · FIRST AID PROTOCOL
              </div>

              <h1
                style={{
                  margin: 0,

                  fontSize: 22,
                  fontWeight: 800,

                  lineHeight: 1.25,

                  color:
                    'var(--text-primary)',
                }}
              >
                {title}
              </h1>
            </div>
          </div>
        </section>

        {/* ───────────────── Language Selector ───────────────── */}

        {availableLangs.length > 1 && (
          <section>
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: '0.08em',
                color: 'var(--text-tertiary)',
                marginBottom: 9,
              }}
            >
              LANGUAGE
            </div>

            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 8,
              }}
            >
              {availableLangs.map((language) => {
                const active =
                  lang === language.code;

                return (
                  <button
                    key={language.code}
                    id={`lang-tab-${language.code}`}
                    onClick={() =>
                      setLang(language.code)
                    }
                    style={{
                      padding: '8px 14px',

                      borderRadius: 999,

                      fontSize: 12,
                      fontWeight: 700,

                      cursor: 'pointer',

                      background: active
                        ? 'var(--accent)'
                        : 'var(--bg-card)',

                      color: active
                        ? '#fff'
                        : 'var(--text-secondary)',

                      border: active
                        ? '1px solid var(--accent)'
                        : '1px solid var(--border)',

                      transition:
                        'all 0.15s ease',
                    }}
                  >
                    {language.native}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* ───────────────── Instructions ───────────────── */}

        <section>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',

              marginBottom: 12,
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: '0.1em',
                color: 'var(--text-tertiary)',
              }}
            >
              EMERGENCY STEPS
            </div>

            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: sev.color,
              }}
            >
              {protocol.steps.length} steps
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            {protocol.steps.map(
              (step, index) => (
                <div
                  key={step.step}
                  style={{
                    display: 'flex',
                    alignItems: 'stretch',
                    gap: 12,

                    padding: 12,

                    background:
                      'var(--bg-card)',

                    border:
                      '1px solid var(--border)',

                    borderRadius: 16,

                    boxShadow:
                      '0 3px 10px rgba(0,0,0,0.04)',
                  }}
                >
                  {/* Large step number */}

                  <div
                    style={{
                      width: 52,
                      minWidth: 52,

                      borderRadius: 13,

                      background: sev.bg,

                      border:
                        `1px solid ${sev.border}`,

                      display: 'flex',
                      flexDirection: 'column',

                      alignItems: 'center',
                      justifyContent: 'center',

                      padding: '8px 0',
                    }}
                  >
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 800,
                        letterSpacing: '0.08em',
                        color:
                          'var(--text-tertiary)',
                        marginBottom: 2,
                      }}
                    >
                      STEP
                    </span>

                    <span
                      style={{
                        fontSize: 22,
                        fontWeight: 900,
                        color: sev.color,
                        lineHeight: 1,
                      }}
                    >
                      {String(
                        index + 1
                      ).padStart(2, '0')}
                    </span>
                  </div>

                  {/* Step instruction */}

                  <div
                    style={{
                      flex: 1,
                      minWidth: 0,

                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10,

                      padding:
                        '7px 4px 7px 0',
                    }}
                  >
                    <span
                      style={{
                        fontSize: 22,
                        lineHeight: 1.35,
                        flexShrink: 0,
                      }}
                    >
                      {ICON_MAP[step.icon] ||
                        '•'}
                    </span>

                    <p
                      style={{
                        margin: 0,

                        fontSize: 15,

                        fontWeight: 500,

                        lineHeight: 1.65,

                        color:
                          'var(--text-primary)',
                      }}
                    >
                      {getStepText(step)}
                    </p>
                  </div>
                </div>
              )
            )}
          </div>
        </section>

        {/* ───────────────── Warnings ───────────────── */}

        {protocol.warnings &&
          protocol.warnings.length > 0 && (
            <section>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: '0.1em',
                  color: 'var(--critical)',
                  marginBottom: 10,
                }}
              >
                IMPORTANT WARNINGS
              </div>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                {protocol.warnings.map(
                  (warning, index) => (
                    <div
                      key={index}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 12,

                        padding: '15px',

                        background:
                          'var(--critical-bg)',

                        border:
                          '1px solid var(--critical-border)',

                        borderLeft:
                          '5px solid var(--critical)',

                        borderRadius: 14,
                      }}
                    >
                      <div
                        style={{
                          width: 32,
                          height: 32,

                          flexShrink: 0,

                          borderRadius: 10,

                          background:
                            'rgba(220,38,38,0.12)',

                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <AlertTriangle
                          size={18}
                          color="var(--critical)"
                        />
                      </div>

                      <p
                        style={{
                          margin: 0,

                          fontSize: 14,
                          lineHeight: 1.6,

                          fontWeight: 500,

                          color:
                            'var(--text-primary)',
                        }}
                      >
                        {warning}
                      </p>
                    </div>
                  )
                )}
              </div>
            </section>
          )}

        {/* ───────────────── Source ───────────────── */}

        {protocol.source && (
          <div
            style={{
              padding: '14px 16px',

              borderRadius: 14,

              background:
                'var(--bg-elevated)',

              border:
                '1px solid var(--border)',

              textAlign: 'center',

              marginTop: 4,
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: '0.08em',

                color:
                  'var(--text-tertiary)',

                marginBottom: 5,
              }}
            >
              MEDICAL GUIDANCE SOURCE
            </div>

            <p
              style={{
                margin: 0,

                fontSize: 12,

                lineHeight: 1.5,

                color:
                  'var(--text-secondary)',
              }}
            >
              {t('source_who', {
                year: '2024',
              })}{' '}
              · {protocol.source}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}