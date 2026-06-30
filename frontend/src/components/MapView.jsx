import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { ChevronLeft, WifiOff } from 'lucide-react';
import { getFacilitiesByCountry } from '../logic/offlineDB';
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

      {/* ── Legend strip — Pure CSS Flexbox ── */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          padding: '12px 16px',
          overflowX: 'auto',
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-card)',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {LEGEND_ITEMS.map(({ type, color, emoji, label }) => (
          <div
            key={type}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              flexShrink: 0,
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: '999px',
              padding: '6px 12px',
            }}
          >
            <div
              style={{
                width: 9,
                height: 9,
                borderRadius: '50%',
                background: color,
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
              {label}
            </span>
          </div>
        ))}
      </div>

      {/* ── Map ── */}
      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        <MapContainer
          center={center}
          zoom={13}
          style={{ height: 'calc(100vh - 110px - var(--safe-top))', width: '100%' }}
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

          {/* Facility markers */}
          {facilities.map((facility) => (
            <Marker
              key={facility.id}
              position={[facility.lat, facility.lng]}
              icon={createColoredIcon(TYPE_COLORS[facility.facility_type] || '#64748B')}
            >
              <Popup>
                <div style={{ minWidth: 180, fontFamily: 'var(--font)' }}>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4, color: 'var(--text-primary)' }}>
                    {facility.name}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10 }}>
                    {facility.facility_type.replace(/_/g, ' ')}
                    {facility.trauma_level ? ` · Level ${facility.trauma_level}` : ''}
                  </div>
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
                        padding: '7px 12px',
                        fontSize: 13,
                        fontWeight: 700,
                        textDecoration: 'none',
                      }}
                    >
                      📞 {facility.phone_primary}
                    </a>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
