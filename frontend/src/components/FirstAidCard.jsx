import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, AlertTriangle } from 'lucide-react';
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
  critical: { color: 'var(--critical)', text: 'var(--critical-text)', bg: 'var(--critical-bg)', border: 'var(--critical-border)', label: 'Critical' },
  serious: { color: 'var(--serious)', text: 'var(--serious-text)', bg: 'var(--serious-bg)', border: 'var(--serious-border)', label: 'Serious' },
  stable: { color: 'var(--stable)', text: 'var(--stable-text)', bg: 'var(--stable-bg)', border: 'var(--stable-border)', label: 'Stable' },
};

const PROTOCOL_TITLES = {
  cpr_needed: 'CPR — Not Breathing',
  critical_trauma: 'Critical Trauma',
  serious_trauma: 'Serious Trauma',
  minor_injury: 'Minor Injury',
};

export default function FirstAidCard() {
  const { protocolId } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const [lang, setLang] = useState(i18n.language?.split('-')[0] || 'en');
  const [protocol, setProtocol] = useState(null);

  useEffect(() => {
    const found = firstAidData.find((p) => p.id === protocolId);
    setProtocol(found || null);
  }, [protocolId]);

  if (!protocol) {
    return (
      <div className="screen items-center justify-center">
        <div className="text-label" style={{ color: 'var(--text-tertiary)' }}>Protocol not found</div>
      </div>
    );
  }

  const sev = SEVERITY_STYLE[protocol.severity] || SEVERITY_STYLE.stable;

  function getStepText(step) {
    const supportedLangs = ['en', 'bn', 'th', 'ne'];
    const activeLang = supportedLangs.includes(lang) ? lang : 'en';
    return step[activeLang] || step.en;
  }

  const availableLangs = LANGUAGES.filter((l) => {
    if (l.code === 'en') return true;
    return protocol.steps.some((s) => s[l.code]);
  });

  const title = PROTOCOL_TITLES[protocol.id] || protocol.id.replace(/_/g, ' ');

  return (
    <div className="screen">
      {/* ── Top bar ── */}
      <header className="topbar">
        <button
          onClick={() => navigate(-1)}
          className="touch-target flex items-center gap-1"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
          id="btn-firstaid-back"
        >
          <ChevronLeft size={22} />
        </button>
        <span className="text-h4">{t('first_aid_guide')}</span>
        <div style={{ width: 40 }} />
      </header>

      <main className="flex-1 flex flex-col px-5 pt-5 pb-8 gap-5">

        {/* ── First Aid Protocol Quick Switcher ── */}
        <div 
          style={{ 
            display: 'flex', 
            gap: '8px', 
            overflowX: 'auto', 
            paddingBottom: '8px', 
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            WebkitOverflowScrolling: 'touch',
            borderBottom: '1px solid var(--border)',
          }}
        >
          {firstAidData.map((proto) => {
            const isActive = proto.id === protocolId;
            const emoji = {
              cpr_needed: '💪',
              critical_trauma: '🩸',
              serious_trauma: '🦴',
              minor_injury: '🩹'
            }[proto.id] || '🩺';
            const label = {
              cpr_needed: 'CPR',
              critical_trauma: 'Severe Bleeding',
              serious_trauma: 'Fracture / Trauma',
              minor_injury: 'Minor Injury'
            }[proto.id] || proto.id;

            return (
              <button
                key={proto.id}
                id={`btn-select-proto-${proto.id}`}
                onClick={() => navigate(`/firstaid/${proto.id}`)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  borderRadius: '999px',
                  padding: '8px 16px',
                  fontSize: '13px',
                  fontWeight: 600,
                  flexShrink: 0,
                  background: isActive ? 'var(--accent)' : 'var(--bg-elevated)',
                  color: isActive ? '#fff' : 'var(--text-secondary)',
                  border: `1.5px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                <span>{emoji}</span>
                {label}
              </button>
            );
          })}
        </div>

        {/* ── Protocol header card ── */}
        <div
          style={{
            background: sev.bg,
            border: `1.5px solid ${sev.border}`,
            borderRadius: 'var(--radius-xl)',
            overflow: 'hidden',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ height: 4, background: sev.color }} />
          <div className="flex items-center gap-3" style={{ padding: '16px 20px' }}>
            <div style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              background: sev.color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            }}>
              <span style={{ fontSize: 22 }}>🩺</span>
            </div>
            <div>
              <div className="text-micro" style={{ color: sev.color, marginBottom: 3 }}>
                {sev.label} · First Aid Protocol
              </div>
              <div className="text-h3" style={{ color: 'var(--text-primary)' }}>
                {title}
              </div>
            </div>
          </div>
        </div>

        {/* ── Language tabs ── */}
        {availableLangs.length > 1 && (
          <div className="flex gap-2 flex-wrap">
            {availableLangs.map((l) => (
              <button
                key={l.code}
                id={`lang-tab-${l.code}`}
                onClick={() => setLang(l.code)}
                style={{
                  borderRadius: 999,
                  padding: '7px 16px',
                  fontSize: 13,
                  fontWeight: 600,
                  background: lang === l.code ? 'var(--accent)' : 'var(--bg-elevated)',
                  color: lang === l.code ? '#fff' : 'var(--text-secondary)',
                  border: `1.5px solid ${lang === l.code ? 'var(--accent)' : 'var(--border)'}`,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {l.native}
              </button>
            ))}
          </div>
        )}

        {/* ── Steps — timeline layout ── */}
        <div className="flex flex-col" style={{ gap: 0 }}>
          {protocol.steps.map((step, idx) => {
            const isLast = idx === protocol.steps.length - 1;
            return (
              <div key={step.step} className="flex gap-4" style={{ position: 'relative', paddingBottom: isLast ? 0 : 20 }}>
                {/* Connecting line */}
                {!isLast && (
                  <div style={{
                    position: 'absolute',
                    left: 17,
                    top: 38,
                    bottom: 0,
                    width: 2,
                    background: 'var(--border)',
                    zIndex: 0,
                  }} />
                )}

                {/* Step badge */}
                <div
                  style={{
                    flexShrink: 0,
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: sev.bg,
                    border: `2px solid ${sev.border}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 14,
                    fontWeight: 800,
                    color: sev.color,
                    position: 'relative',
                    zIndex: 1,
                  }}
                >
                  {step.step}
                </div>

                {/* Step content */}
                <div
                  style={{
                    flex: 1,
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '14px 16px',
                    boxShadow: 'var(--shadow-xs)',
                    marginTop: 2,
                  }}
                >
                  <div className="flex items-start gap-2">
                    <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>
                      {ICON_MAP[step.icon] || '•'}
                    </span>
                    <p style={{ fontSize: 15, lineHeight: 1.65, color: 'var(--text-primary)' }}>
                      {getStepText(step)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Warnings ── */}
        {protocol.warnings && protocol.warnings.length > 0 && (
          <div className="flex flex-col gap-3">
            {protocol.warnings.map((warning, i) => (
              <div
                key={i}
                className="flex items-start gap-3 rounded-xl p-4"
                style={{
                  background: 'var(--critical-bg)',
                  border: '1px solid var(--critical-border)',
                  borderLeft: '4px solid var(--critical)',
                  boxShadow: 'var(--shadow-xs)',
                }}
              >
                <AlertTriangle size={16} color="var(--critical)" style={{ flexShrink: 0, marginTop: 2 }} />
                <span style={{ fontSize: 14, lineHeight: 1.65, color: 'var(--text-primary)' }}>
                  {warning}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* ── Source attribution ── */}
        {protocol.source && (
          <div
            style={{
              padding: '12px 16px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
            }}
          >
            <p className="text-label text-center" style={{ color: 'var(--text-tertiary)' }}>
              {t('source_who', { year: '2024' })} · {protocol.source}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
