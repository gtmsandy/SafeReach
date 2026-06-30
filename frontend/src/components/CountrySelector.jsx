import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, CheckCircle2 } from 'lucide-react';
import emergencyNumbers from '../data/emergency_numbers.json';

export default function CountrySelector() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [selected, setSelected] = useState(
    localStorage.getItem('safereach_country') || 'BD'
  );

  function handleSelect(code) {
    setSelected(code);
    localStorage.setItem('safereach_country', code);
  }

  const selectedInfo = emergencyNumbers.find((e) => e.country_code === selected);

  return (
    <div className="screen">
      {/* ── Top bar ── */}
      <header className="topbar">
        <button
          onClick={() => navigate(-1)}
          className="touch-target flex items-center gap-1"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
          id="btn-countries-back"
        >
          <ChevronLeft size={22} />
        </button>
        <span className="text-h4">{t('country_select')}</span>
        <div style={{ width: 40 }} />
      </header>

      <main className="flex-1 flex flex-col px-5 pt-5 pb-8 gap-5">

        {/* ── Selected country card — dark treatment ── */}
        {selectedInfo && (
          <div className="call-card">
            <div className="flex items-center gap-3 mb-4">
              <span style={{ fontSize: 32 }}>{selectedInfo.flag}</span>
              <div>
                <div className="text-micro" style={{ color: 'rgba(255,255,255,0.45)', marginBottom: 3 }}>
                  SELECTED COUNTRY
                </div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                  {selectedInfo.country_name}
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <EmergencyNumDisplay label={t('police')} number={selectedInfo.police} />
              <EmergencyNumDisplay label={t('ambulance')} number={selectedInfo.ambulance} />
              <EmergencyNumDisplay label="Unified" number={selectedInfo.unified} />
            </div>
          </div>
        )}

        {/* ── Explanation Card ── */}
        <div
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-xl)',
            padding: '16px 20px',
            fontSize: '13.5px',
            lineHeight: 1.5,
            color: 'var(--text-secondary)'
          }}
        >
          <strong>🌎 Regional Selector:</strong> Changing the active country updates the emergency numbers on your home screen and loads the corresponding local hospital & trauma center markers offline.
        </div>

        {/* ── Country grid ── */}
        <div>
          <div className="text-micro mb-3" style={{ color: 'var(--text-tertiary)' }}>
            BIMSTEC Nations
          </div>
          <div className="grid grid-cols-2 gap-3">
            {emergencyNumbers.map((country) => {
              const isSelected = country.country_code === selected;
              return (
                <button
                  key={country.country_code}
                  id={`country-${country.country_code}`}
                  onClick={() => handleSelect(country.country_code)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    borderRadius: 'var(--radius-xl)',
                    padding: '14px 14px',
                    background: isSelected ? 'var(--accent-light)' : 'var(--bg-card)',
                    border: `${isSelected ? '2px' : '1px'} solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    textAlign: 'left',
                    width: '100%',
                    boxShadow: isSelected ? '0 0 0 0px transparent' : 'var(--shadow-xs)',
                  }}
                >
                  <span style={{ fontSize: 26 }}>{country.flag}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: isSelected ? 700 : 500,
                        color: isSelected ? 'var(--accent)' : 'var(--text-primary)',
                        marginBottom: 2,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {country.country_name}
                    </div>
                    <div className="text-label" style={{ color: 'var(--text-tertiary)' }}>
                      🚑 {country.ambulance}
                    </div>
                  </div>
                  {isSelected && <CheckCircle2 size={17} color="var(--accent)" style={{ flexShrink: 0 }} />}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Confirm ── */}
        <button
          id="btn-confirm-country"
          className="btn-primary"
          onClick={() => navigate('/')}
        >
          Confirm Selection
        </button>
      </main>
    </div>
  );
}

function EmergencyNumDisplay({ label, number }) {
  return (
    <a
      href={`tel:${number}`}
      className="call-btn"
      style={{ position: 'relative', overflow: 'hidden', paddingBottom: '30px' }}
    >
      <span style={{ fontSize: 18, fontWeight: 800, color: '#fff', fontVariantNumeric: 'tabular-nums', marginTop: 4 }}>
        {number}
      </span>
      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>{label}</span>
      
      {/* Clear call-to-action bar */}
      <div style={{
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
        gap: '3px'
      }}>
        <span>📞</span> Tap to Call
      </div>
    </a>
  );
}
