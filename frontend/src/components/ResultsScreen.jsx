import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, Navigation, Phone, AlertTriangle, ChevronRight, MapPin } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { getFacilitiesByCountry, updateFacilityVerification, seedDatabase, db } from '../logic/offlineDB';
import { rankFacilities } from '../logic/ranking';
import SilentSOSButton from './SilentSOSButton';
import emergencyNumbers from '../data/emergency_numbers.json';

// Fix Leaflet default marker icon issue with Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const SEVERITY_CONFIG = {
  critical: {
    label: 'Critical',
    color: 'var(--critical)',
    text: 'var(--critical-text)',
    bg: 'var(--critical-bg)',
    border: 'var(--critical-border)',
    icon: '⬤',
    emoji: '🔴',
  },
  serious: {
    label: 'Serious',
    color: 'var(--serious)',
    text: 'var(--serious-text)',
    bg: 'var(--serious-bg)',
    border: 'var(--serious-border)',
    icon: '⬤',
    emoji: '🟡',
  },
  stable: {
    label: 'Stable',
    color: 'var(--stable)',
    text: 'var(--stable-text)',
    bg: 'var(--stable-bg)',
    border: 'var(--stable-border)',
    icon: '⬤',
    emoji: '🟢',
  },
};

function MapBoundsFitter({ userPos, facilityPos }) {
  const map = useMap();
  useEffect(() => {
    if (userPos && facilityPos) {
      const bounds = L.latLngBounds(
        [userPos.lat, userPos.lng],
        [facilityPos.lat, facilityPos.lng]
      );
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [userPos, facilityPos, map]);
  return null;
}

export default function ResultsScreen() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [result, setResult] = useState(null);
  
  // Tab-specific facility states
  const [medicalFacilities, setMedicalFacilities] = useState([]);
  const [policeFacilities, setPoliceFacilities] = useState([]);
  const [assistanceFacilities, setAssistanceFacilities] = useState([]);
  const [activeTab, setActiveTab] = useState('medical'); // 'medical', 'police', 'assistance'

  const [userPos, setUserPos] = useState(null);
  const [countryInfo, setCountryInfo] = useState(null);
  const [verifySheet, setVerifySheet] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = sessionStorage.getItem('triage_result');
    if (!stored) { navigate('/'); return; }
    const parsed = JSON.parse(stored);
    setResult(parsed);

    const countryCode = localStorage.getItem('safereach_country') || 'BD';
    const info = emergencyNumbers.find((e) => e.country_code === countryCode);
    setCountryInfo(info);

    navigator.geolocation?.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setUserPos({ lat: latitude, lng: longitude });
        await loadFacilities(parsed, latitude, longitude, countryCode);
      },
      async () => { 
        await loadFacilities(parsed, null, null, countryCode); 
      },
      { timeout: 5000 }
    );
  }, []);

  async function loadFacilities(result, lat, lng, countryCode) {
    try {
      let all = await getFacilitiesByCountry(countryCode);

      // Database fallback chain if empty
      if (all.length === 0) {
        await seedDatabase();
        all = await getFacilitiesByCountry(countryCode);
      }

      // Filter strictly by countryCode and category — no cross-country fallback, no mock data
      const hospitals = all.filter((f) => ['hospital', 'trauma_center', 'clinic'].includes(f.facility_type));
      const police = all.filter((f) => f.facility_type === 'police');
      const assistance = all.filter((f) => ['towing', 'puncture_shop', 'ambulance'].includes(f.facility_type));

      // Rank each category
      if (lat && lng) {
        setMedicalFacilities(rankFacilities(hospitals, result.severity, lat, lng));
        setPoliceFacilities(rankFacilities(police, result.severity, lat, lng));
        setAssistanceFacilities(rankFacilities(assistance, result.severity, lat, lng));
      } else {
        setMedicalFacilities(hospitals.slice(0, 3));
        setPoliceFacilities(police.slice(0, 3));
        setAssistanceFacilities(assistance.slice(0, 3));
      }
    } catch (e) {
      console.warn('Facilities load error:', e);
    }
    setLoading(false);
  }

  // Active facilities mapped by active Tab
  const activeFacilities = {
    medical: medicalFacilities,
    police: policeFacilities,
    assistance: assistanceFacilities
  }[activeTab] || [];

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        const pending = localStorage.getItem('verify_pending');
        if (pending) {
          const { facilityId } = JSON.parse(pending);
          const allLists = [...medicalFacilities, ...policeFacilities, ...assistanceFacilities];
          const facility = allLists.find((f) => f.id === facilityId);
          if (facility) setVerifySheet({ facility });
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [medicalFacilities, policeFacilities, assistanceFacilities]);

  function handleNavigate(facility) {
    localStorage.setItem('verify_pending', JSON.stringify({ facilityId: facility.id, facilityName: facility.name }));
    window.open(`https://maps.google.com/?q=${facility.lat},${facility.lng}`, '_blank');
  }

  async function handleVerify(facility, isOperational) {
    await updateFacilityVerification(facility.id, isOperational);
    try {
      await fetch(`${import.meta.env.VITE_API_URL || ''}/api/v1/verify/${facility.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_operational: isOperational, device_hash: 'browser' }),
      });
    } catch {}
    localStorage.removeItem('verify_pending');
    setVerifySheet(null);
  }

  if (!result) return null;

  const config = SEVERITY_CONFIG[result.severity] || SEVERITY_CONFIG.stable;

  return (
    <div className="screen">
      {/* ── Top bar ── */}
      <header className="topbar">
        <button
          onClick={() => navigate('/triage')}
          className="touch-target flex items-center gap-1"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
          id="btn-results-back"
        >
          <ChevronLeft size={22} />
        </button>
        <span className="text-h4">Assessment Results</span>
        <div style={{ width: 40 }} />
      </header>

      <main className="flex-1 flex flex-col gap-4 px-5 pt-5 pb-24">

        {/* ── Severity banner ── */}
        <div
          style={{
            background: config.bg,
            border: `1.5px solid ${config.border}`,
            borderRadius: 'var(--radius-xl)',
            overflow: 'hidden',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          {/* Severity stripe */}
          <div style={{
            height: 4,
            background: config.color,
            width: '100%',
          }} />

          <div style={{ padding: '16px 20px 20px' }}>
            <div className="flex items-center gap-3 mb-1">
              <span style={{ fontSize: 26 }}>{config.emoji}</span>
              <div>
                <div
                  className="text-micro"
                  style={{ color: config.color, marginBottom: 3 }}
                >
                  SEVERITY ASSESSMENT
                </div>
                <div
                  style={{
                    fontSize: 26,
                    fontWeight: 800,
                    color: config.color,
                    lineHeight: 1.1,
                    letterSpacing: '-0.02em',
                  }}
                >
                  {config.label}
                </div>
              </div>
            </div>

            {result.flags?.includes('NO_MOVE') && (
              <div
                className="flex items-center gap-2 mt-3 rounded-xl p-3"
                style={{ background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.06)' }}
              >
                <AlertTriangle size={15} color="var(--serious)" />
                <span className="text-label" style={{ color: 'var(--serious-text)' }}>
                  Do NOT move the victim — suspected spinal injury
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ── Call ambulance ── */}
        {countryInfo && (
          <a
            href={`tel:${countryInfo.ambulance}`}
            id="btn-call-ambulance-main"
            className="btn-primary"
            style={{ textDecoration: 'none', paddingTop: 20, paddingBottom: 20, fontSize: 17 }}
          >
            <Phone size={20} strokeWidth={2.5} />
            {t('call_ambulance')} · {countryInfo.ambulance}
          </a>
        )}

        {/* ── live Route Map Preview (updates dynamically with active tab) ── */}
        {userPos && activeFacilities.length > 0 && (
          <div
            className="sr-card"
            style={{
              padding: 0,
              overflow: 'hidden',
              borderRadius: 'var(--radius-xl)',
              height: 240,
              border: '1px solid var(--border)',
              position: 'relative'
            }}
          >
            <MapContainer
              center={[userPos.lat, userPos.lng]}
              zoom={12}
              zoomControl={false}
              style={{ height: '100%', width: '100%', zIndex: 1 }}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='© OSM'
              />
              
              {/* User Location */}
              <Marker
                position={[userPos.lat, userPos.lng]}
                icon={L.divIcon({
                  html: `<div style="
                    width: 16px; height: 16px;
                    background: var(--accent-bright);
                    border: 3px solid white;
                    border-radius: 50%;
                    box-shadow: 0 0 0 4px rgba(37,99,168,0.2), 0 1px 6px rgba(0,0,0,0.3);
                  "></div>`,
                  iconSize: [16, 16],
                  iconAnchor: [8, 8],
                  className: '',
                })}
              >
                <Popup>📍 Your Location</Popup>
              </Marker>

              {/* Nearest Hospital/Police/Tow of Selected Tab */}
              <Marker
                position={[activeFacilities[0].lat, activeFacilities[0].lng]}
                icon={L.divIcon({
                  html: `<div style="
                    width: 22px; height: 22px;
                    background: ${activeTab === 'medical' ? '#B83025' : activeTab === 'police' ? '#1E3A8A' : '#D97706'};
                    border: 2.5px solid white;
                    border-radius: 50%;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.35);
                  "></div>`,
                  iconSize: [22, 22],
                  iconAnchor: [11, 11],
                  className: '',
                })}
              >
                <Popup>{activeFacilities[0].name}</Popup>
              </Marker>

              {/* Route Connecting Line */}
              <Polyline
                positions={[
                  [userPos.lat, userPos.lng],
                  [activeFacilities[0].lat, activeFacilities[0].lng]
                ]}
                color="var(--accent)"
                weight={3}
                dashArray="5, 8"
              />
              
              <MapBoundsFitter userPos={userPos} facilityPos={activeFacilities[0]} />
            </MapContainer>
          </div>
        )}

        {/* ── Segmented Category Switcher Tabs ── */}
        <div style={{
          display: 'flex',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-xl)',
          padding: '4px',
          gap: '4px',
          marginTop: '6px'
        }}>
          {[
            { id: 'medical', label: '🏥 Medical' },
            { id: 'police', label: '👮 Police' },
            { id: 'assistance', label: '🔧 Assistance' }
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              style={{
                flex: 1,
                border: 'none',
                background: activeTab === t.id ? 'var(--accent)' : 'none',
                color: activeTab === t.id ? '#fff' : 'var(--text-secondary)',
                padding: '10px 4px',
                borderRadius: 'var(--radius-lg)',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Nearest facilities list ── */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <MapPin size={15} color="var(--text-tertiary)" />
            <span className="text-h4" style={{ color: 'var(--text-secondary)' }}>
              Nearest {activeTab === 'medical' ? 'Medical' : activeTab === 'police' ? 'Police Stations' : 'Roadside Assistance'}
            </span>
          </div>

          {loading ? (
            <div className="text-label text-center py-8" style={{ color: 'var(--text-tertiary)' }}>
              <div style={{ marginBottom: 8, fontSize: 22 }}>🔍</div>
              Finding nearby facilities...
            </div>
          ) : activeFacilities.length === 0 ? (
            <div
              id="empty-facilities-notice"
              style={{
                padding: '20px 16px',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-xl)',
                textAlign: 'center',
                margin: '8px 0',
              }}
            >
              <div style={{ fontSize: 26, marginBottom: 8 }}>🚨</div>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', marginBottom: 6 }}>
                No verified {activeTab === 'medical' ? 'medical' : activeTab === 'police' ? 'police' : 'roadside assistance'} facilities in local dataset
              </div>
              <p
                style={{
                  fontSize: 12,
                  color: 'var(--text-secondary)',
                  lineHeight: 1.5,
                  marginBottom: 14,
                  maxWidth: 360,
                  margin: '0 auto 14px',
                }}
              >
                This does not mean no real facility exists. Connect directly with national emergency dispatch for urgent roadside assistance.
              </p>
              {countryInfo && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 4 }}>
                  {(countryInfo.ambulance || countryInfo.unified) && (
                    <div
                      style={{
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-xl)',
                        padding: '14px 16px',
                        textAlign: 'center',
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.07em',
                          color: 'var(--text-tertiary)',
                          marginBottom: 10,
                        }}
                      >
                        🏥 Nearest Medical
                      </div>
                      <a
                        href={`tel:${countryInfo.ambulance || countryInfo.unified}`}
                        className="btn-primary"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          textDecoration: 'none',
                          fontSize: 15,
                          fontWeight: 800,
                          padding: '12px 20px',
                        }}
                      >
                        🚑 Call {countryInfo.ambulance || countryInfo.unified}
                      </a>
                    </div>
                  )}
                  {countryInfo.police && (
                    <div
                      style={{
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-xl)',
                        padding: '14px 16px',
                        textAlign: 'center',
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.07em',
                          color: 'var(--text-tertiary)',
                          marginBottom: 10,
                        }}
                      >
                        👮 Police
                      </div>
                      <a
                        href={`tel:${countryInfo.police}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          textDecoration: 'none',
                          fontSize: 15,
                          fontWeight: 800,
                          padding: '12px 20px',
                          borderRadius: 'var(--radius-lg)',
                          background: '#1E3A8A',
                          color: '#FFFFFF',
                          border: 'none',
                        }}
                      >
                        👮 Call {countryInfo.police}
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {activeFacilities.map((facility, i) => (
                <FacilityCard
                  key={facility.id}
                  facility={facility}
                  severity={result.severity}
                  config={config}
                  rank={i + 1}
                  isNearest={i === 0}
                  onNavigate={() => handleNavigate(facility)}
                  t={t}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── First aid guide card ── */}
        <button
          id="btn-first-aid-guide"
          onClick={() => navigate(`/firstaid/${result.first_aid_id}`)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderRadius: 'var(--radius-xl)',
            padding: '18px 20px',
            background: 'var(--accent-light)',
            border: '1.5px solid rgba(27, 58, 92, 0.2)',
            cursor: 'pointer',
            width: '100%',
            boxShadow: 'var(--shadow-sm)',
            transition: 'all var(--transition-fast)',
          }}
        >
          <div className="flex items-center gap-3">
            <div style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: 'var(--accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <span style={{ fontSize: 22 }}>🩺</span>
            </div>
            <div className="text-left">
              <div className="text-h4" style={{ color: 'var(--accent)', marginBottom: 2 }}>
                {t('first_aid_guide')}
              </div>
              <div className="text-label">{t('while_waiting')}</div>
            </div>
          </div>
          <ChevronRight size={20} color="var(--accent)" />
        </button>
      </main>

      {/* ── Facility verification bottom sheet ── */}
      {verifySheet && (
        <>
          <div className="bottom-sheet-backdrop" onClick={() => setVerifySheet(null)} />
          <div className="bottom-sheet">
            <div className="bottom-sheet-handle" />
            <div className="text-h3 mb-1">{t('verify_facility_title')}</div>
            <div className="text-body mb-1" style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>
              {verifySheet.facility.name}
            </div>
            <p className="text-label mb-6" style={{ color: 'var(--text-tertiary)' }}>
              Was this facility open and operational when you visited?
            </p>
            <div className="flex gap-3">
              <button
                id="btn-verify-yes"
                className="flex-1 btn-primary"
                style={{ background: 'linear-gradient(135deg, #14532D, var(--stable))', paddingTop: 14, paddingBottom: 14 }}
                onClick={() => handleVerify(verifySheet.facility, true)}
              >
                ✓ {t('verify_yes')}
              </button>
              <button
                id="btn-verify-no"
                className="flex-1 btn-outline"
                style={{ borderColor: 'var(--critical)', color: 'var(--critical)', paddingTop: 14, paddingBottom: 14 }}
                onClick={() => handleVerify(verifySheet.facility, false)}
              >
                ✗ {t('verify_no')}
              </button>
              <button
                id="btn-verify-skip"
                className="btn-ghost"
                style={{ padding: '14px 16px' }}
                onClick={() => { localStorage.removeItem('verify_pending'); setVerifySheet(null); }}
              >
                {t('verify_skip')}
              </button>
            </div>
          </div>
        </>
      )}

      <SilentSOSButton country={countryInfo} />
    </div>
  );
}

function FacilityCard({ facility, severity, config, rank, isNearest, onNavigate, t }) {
  const [expanded, setExpanded] = useState(false);
  
  const typeLabel = {
    hospital: '🏥 Hospital',
    trauma_center: '🚨 Trauma Center',
    police: '👮 Police Station',
    ambulance: '🚑 Ambulance Service',
    blood_bank: '🩸 Blood Bank',
    clinic: '🏪 Clinic',
    towing: '🚗 Towing Service',
    puncture_shop: '🔧 Mechanic / Puncture Shop',
  }[facility.facility_type] || facility.facility_type;

  const descLabel = {
    hospital: 'Full-service offline medical facility equipped with emergency ward, physicians, and triage capabilities.',
    trauma_center: 'Specialized trauma unit offering rapid stabilization, trauma surgery, and critical resuscitation.',
    police: '24/7 law enforcement station supporting incident reports, traffic control, and emergency bystander guidance.',
    towing: 'Highway vehicle recovery service with flatbed assistance and rapid site cleanup capabilities.',
    puncture_shop: 'Mobile road assistance offering tyre repairs, engine fluid top-ups, and minor mechanical fixes.',
  }[facility.facility_type] || 'Offline registered public support center verified under regional road emergency guidelines.';

  return (
    <div
      className="facility-card"
      id={`facility-card-${rank}`}
      onClick={() => setExpanded(!expanded)}
      style={{
        position: 'relative',
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        background: 'var(--bg-card)',
        border: expanded ? '2px solid var(--accent)' : '1px solid var(--border)',
        borderRadius: 'var(--radius-xl)',
        boxShadow: expanded ? 'var(--shadow-sm)' : 'var(--shadow-xs)'
      }}
    >
      {/* Left accent stripe */}
      <div style={{
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: 4,
        background: isNearest ? 'var(--stable)' : 'var(--accent)',
        opacity: 0.7,
      }} />

      <div style={{ padding: '16px 16px 16px 20px' }}>
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-h4" style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
                {facility.name}
              </span>
              {isNearest && (
                <span style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: 'var(--stable-text)',
                  background: 'var(--stable-bg)',
                  border: '1px solid var(--stable-border)',
                  borderRadius: 999,
                  padding: '1px 7px',
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  flexShrink: 0,
                }}>
                  Nearest
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-label" style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                {typeLabel}
              </span>
              {facility.trauma_level && (
                <span
                  className="text-label"
                  style={{
                    background: 'var(--accent-light)',
                    color: 'var(--accent)',
                    borderRadius: 999,
                    padding: '1px 8px',
                    fontSize: '11px'
                  }}
                >
                  Level {facility.trauma_level}
                </span>
              )}
              {facility.verified && (
                <span
                  className="text-label"
                  style={{
                    background: 'var(--stable-bg)',
                    color: 'var(--stable-text)',
                    borderRadius: 999,
                    padding: '1px 8px',
                    fontSize: '11px'
                  }}
                >
                  ✓ Verified
                </span>
              )}
            </div>
          </div>

          {facility.distance_km !== undefined && (
            <span
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: 'var(--text-primary)',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 999,
                padding: '4px 10px',
                flexShrink: 0,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {facility.distance_km} km
            </span>
          )}
        </div>

        {/* Collapsible details accordion */}
        {expanded && (
          <div 
            style={{ 
              marginTop: 12, 
              paddingTop: 12, 
              borderTop: '1px dashed var(--border)', 
              fontSize: 13, 
              lineHeight: 1.5,
              color: 'var(--text-secondary)',
              display: 'flex',
              flexDirection: 'column',
              gap: 8
            }}
          >
            <div>
              <strong>📍 Coordinates:</strong> {facility.lat.toFixed(5)}, {facility.lng.toFixed(5)}
            </div>
            <div>
              <strong>📞 Contact:</strong> {facility.phone_primary || 'Local Emergency Unified Dialer'}
            </div>
            <div style={{ fontStyle: 'italic', color: 'var(--text-tertiary)' }}>
              {descLabel}
            </div>
          </div>
        )}

        <div className="flex gap-2 mt-3" onClick={(e) => e.stopPropagation()}>
          <button
            className="btn-ghost flex-1"
            style={{ fontSize: 14, paddingTop: 10, paddingBottom: 10 }}
            onClick={onNavigate}
            id={`btn-navigate-${facility.id}`}
          >
            <Navigation size={15} />
            {t('navigate')}
          </button>
          {facility.phone_primary && (
            <a
              href={`tel:${facility.phone_primary}`}
              className="btn-primary flex-1"
              style={{ padding: '10px 14px', fontSize: 14, textDecoration: 'none' }}
              id={`btn-call-facility-${facility.id}`}
            >
              <Phone size={15} />
              {t('call')}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
