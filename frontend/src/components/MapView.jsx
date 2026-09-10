import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { ChevronLeft, WifiOff, MapPin, Navigation } from 'lucide-react';
import { getFacilitiesByCountry } from '../logic/offlineDB';
import { haversine } from '../logic/haversine';
import { filterFacilities, getFilterCounts } from '../logic/mapFiltering';
import bimstecBounds from '../data/bimstec_bounds.json';

// Fix Leaflet default marker icon issue with Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const LEGEND_ITEMS = [
  { type: 'hospital',      color: '#B83025', emoji: '🏥', label: 'Hospital' },
  { type: 'trauma_center', color: '#7F1D1D', emoji: '🚨', label: 'Trauma' },
  { type: 'police',        color: '#1B3A5C', emoji: '👮', label: 'Police' },
  { type: 'ambulance',     color: '#1F7A54', emoji: '🚑', label: 'Ambulance' },
  { type: 'towing',        color: '#C47A0E', emoji: '🚗', label: 'Towing' },
];

const TYPE_COLORS = {
  hospital: '#B83025',
  trauma_center: '#7F1D1D',
  police: '#1B3A5C',
  ambulance: '#1F7A54',
  blood_bank: '#7C3AED',
  towing: '#C47A0E',
  puncture_shop: '#64748B',
  clinic: '#0891B2',
};

function createColoredIcon(color) {
  return L.divIcon({
    html: `<div style="
      width: 22px; height: 22px;
      background: ${color};
      border: 2.5px solid white;
      border-radius: 50%;
      box-shadow: 0 2px 8px rgba(0,0,0,0.35);
    "></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -13],
    className: '',
  });
}

function TileErrorHandler({ onError }) {
  const map = useMap();
  useEffect(() => {
    const handleTileError = () => onError();
    map.on('tileerror', handleTileError);
    return () => map.off('tileerror', handleTileError);
  }, [map, onError]);
  return null;
}

function MapCenterSetter({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.setView([position[0], position[1]], map.getZoom() || 13);
  }, [position, map]);
  return null;
}

export default function MapView() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [facilities, setFacilities] = useState([]);
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [userPos, setUserPos] = useState(null);
  const [tileError, setTileError] = useState(false);
  const [center, setCenter] = useState([23.8103, 90.4125]); // Default Dhaka
  useEffect(() => {
    const countryCode = localStorage.getItem('safereach_country') || 'BD';
    getFacilitiesByCountry(countryCode).then(setFacilities);

    // Calculate default center of country bounds
    const bounds = bimstecBounds.find((b) => b.country_code === countryCode);
    let countryCenter = [23.8103, 90.4125];
    if (bounds) {
      countryCenter = [
        (bounds.min_lat + bounds.max_lat) / 2,
        (bounds.min_lng + bounds.max_lng) / 2,
      ];
      setCenter(countryCenter);
    }

    navigator.geolocation?.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setUserPos({ lat: latitude, lng: longitude });

        // Only center on user location if they are inside the bounds of the active country
        if (bounds) {
          if (
            latitude >= bounds.min_lat &&
            latitude <= bounds.max_lat &&
            longitude >= bounds.min_lng &&
            longitude <= bounds.max_lng
          ) {
            setCenter([latitude, longitude]);
          } else {
            console.info(
              `[SafeReach Map] User outside active country (${countryCode}). Centering on country center instead.`,
              countryCenter
            );
          }
        }
      },
      () => {},
      { timeout: 8000 }
    );
  }, []);

  const FILTER_OPTIONS = [
    { id: 'all', label: t('filter_all') || 'All', emoji: '🌐' },
    { id: 'hospital', label: t('filter_hospitals') || 'Hospitals', emoji: '🏥' },
    { id: 'police', label: t('filter_police') || 'Police', emoji: '👮' },
    { id: 'towing', label: t('filter_towing') || 'Towing', emoji: '🚗' },
  ];
  const counts = useMemo(() => getFilterCounts(facilities), [facilities]);


  const filteredFacilities = useMemo(() => {
    return filterFacilities(facilities, selectedFilter);
  }, [facilities, selectedFilter]);

  const currentFilterLabel = useMemo(() => {
    const opt = FILTER_OPTIONS.find((o) => o.id === selectedFilter);
    return opt ? opt.label : 'Facilities';
  }, [selectedFilter, t]);

  return (
    <div className="screen">
      {/* ── Top bar ── */}
      <header className="topbar">
        <button
          onClick={() => navigate(-1)}
          className="touch-target"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '8px',
          }}
          id="btn-map-back"
        >
          <ChevronLeft size={22} />
        </button>
        <span className="text-h4">Emergency Map</span>
        <div style={{ width: 40 }} />
      </header>

      {/* ── Tile error banner ── */}
      {tileError && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px 20px',
            background: 'var(--serious-bg)',
            borderBottom: '1px solid var(--serious-border)',
            animation: 'scaleIn 0.2s ease',
          }}
        >
          <WifiOff size={17} color="var(--serious)" style={{ flexShrink: 0 }} />
          <div>
            <div className="text-h4" style={{ color: 'var(--serious-text)', marginBottom: 1 }}>
              Map tiles not cached
            </div>
            <div className="text-label">{t('map_not_cached')} — go to Settings to download offline map.</div>
          </div>
        </div>
      )}

      {/* ── Facility Filter Bar ── */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          padding: '10px 16px',
          overflowX: 'auto',
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-card)',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch',
        }}
        role="toolbar"
        aria-label="Filter emergency facilities"
      >
        {FILTER_OPTIONS.map((opt) => {
          const isSelected = selectedFilter === opt.id;
          const count = counts[opt.id] ?? 0;
          return (
            <button
              key={opt.id}
              id={`btn-filter-${opt.id}`}
              onClick={() => setSelectedFilter(opt.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                flexShrink: 0,
                minHeight: '44px',
                padding: '8px 14px',
                borderRadius: '999px',
                border: `1.5px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                background: isSelected ? 'var(--accent)' : 'var(--bg-elevated)',
                color: isSelected ? '#FFFFFF' : 'var(--text-secondary)',
                fontWeight: isSelected ? 700 : 600,
                fontSize: 13,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              role="button"
              aria-pressed={isSelected}
              aria-label={`${opt.label}: ${count} facilities`}
            >
              <span>{opt.emoji}</span>
              <span>{opt.label}</span>
              <span
                style={{
                  fontSize: 11,
                  padding: '2px 7px',
                  borderRadius: 999,
                  background: isSelected ? 'rgba(255,255,255,0.25)' : 'var(--border)',
                  color: isSelected ? '#FFFFFF' : 'var(--text-tertiary)',
                  fontWeight: 700,
                }}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Active Facility Status Subbar ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 16px',
          background: 'var(--bg-elevated)',
          borderBottom: '1px solid var(--border)',
          fontSize: 12,
          color: 'var(--text-secondary)',
          fontWeight: 600,
        }}
      >
        <span>
          {currentFilterLabel}: {filteredFacilities.length} {t('facilities') || 'facilities'}
        </span>
        {userPos && (
          <span style={{ fontSize: 11, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 3 }}>
            <MapPin size={12} />
            GPS Active
          </span>
        )}
      </div>
      {/* ── Map Canvas ── */}
      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        {/* Empty state notice for zero facilities */}
        {filteredFacilities.length === 0 && (
          <div
            id="map-empty-state"
            style={{
              position: 'absolute',
              top: 14,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 1000,
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-md)',
              borderRadius: 'var(--radius-lg)',
              padding: '10px 18px',
              maxWidth: '90%',
              textAlign: 'center',
              pointerEvents: 'none',
              animation: 'scaleIn 0.2s ease',
            }}
            role="status"
            aria-live="polite"
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              <span>{facilities.length === 0 ? '🚨' : '⚠️'}</span>
              <span>
                {facilities.length === 0
                  ? (t('no_verified_facilities_region') || 'No verified emergency facilities available for this region.')
                  : (t('no_facilities_in_category', { category: currentFilterLabel }) || `No ${currentFilterLabel.toLowerCase()} found in this region.`)}
              </span>
            </div>
          </div>
        )}

        <MapContainer
          center={center}
          zoom={13}
          style={{ height: 'calc(100vh - 150px - var(--safe-top))', width: '100%' }}
          id="leaflet-map"
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />
          <TileErrorHandler onError={() => setTileError(true)} />
          <MapCenterSetter position={center} />

          {/* User location */}
          {userPos && (
            <Marker
              position={[userPos.lat, userPos.lng]}
              icon={L.divIcon({
                html: `<div style="
                  width: 18px; height: 18px;
                  background: var(--accent-bright);
                  border: 3px solid white;
                  border-radius: 50%;
                  box-shadow: 0 0 0 5px rgba(37,99,168,0.2), 0 2px 8px rgba(0,0,0,0.3);
                "></div>`,
                iconSize: [18, 18],
                iconAnchor: [9, 9],
                className: '',
              })}
            >
              <Popup>📍 Your location</Popup>
            </Marker>
          )}

          {/* Filtered Facility markers */}
          {filteredFacilities.map((facility) => {
            const dist =
              userPos && facility.lat && facility.lng
                ? Math.round(haversine(userPos.lat, userPos.lng, facility.lat, facility.lng) * 10) / 10
                : null;
            return (
              <Marker
                key={facility.id}
                position={[facility.lat, facility.lng]}
                icon={createColoredIcon(TYPE_COLORS[facility.facility_type] || '#64748B')}
              >
                <Popup>
                  <div style={{ minWidth: 180, fontFamily: 'var(--font)' }}>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2, color: 'var(--text-primary)' }}>
                      {facility.name}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: dist ? 4 : 8 }}>
                      {facility.facility_type.replace(/_/g, ' ')}
                      {facility.trauma_level ? ` · Level ${facility.trauma_level}` : ''}
                    </div>
                    {dist !== null && (
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-bright)', marginBottom: 8 }}>
                        📍 {dist} km away
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {facility.phone_primary && (
                        <a
                          href={`tel:${facility.phone_primary}`}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            background: 'linear-gradient(135deg, var(--accent), var(--accent-bright))',
                            color: '#fff',
                            borderRadius: 8,
                            padding: '6px 10px',
                            fontSize: 12,
                            fontWeight: 700,
                            textDecoration: 'none',
                          }}
                        >
                          📞 Call
                        </a>
                      )}
                      <a
                        href={`https://maps.google.com/?q=${facility.lat},${facility.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          background: 'var(--bg-elevated)',
                          border: '1px solid var(--border)',
                          color: 'var(--text-primary)',
                          borderRadius: 8,
                          padding: '6px 10px',
                          fontSize: 12,
                          fontWeight: 600,
                          textDecoration: 'none',
                        }}
                      >
                        🧭 Directions
                      </a>
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>
    </div>
  );
}
