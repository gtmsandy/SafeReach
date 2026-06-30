import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ChevronLeft, User, Send, Activity,
  Globe, MapPin, Database, Info, WifiOff, CheckCircle2, AlertCircle,
} from 'lucide-react';
import { LANGUAGES } from '../i18n/index.js';
import { getFacilityCount, getLastSync, getMapCacheStatus } from '../logic/offlineDB';
import { requestMotionPermission, isSupported } from '../logic/crashDetection';
import { prewarmTiles, prewarmLocalArea, prewarmAllCountries } from '../logic/prewarmTiles';
import bimstecBounds from '../data/bimstec_bounds.json';
import emergencyNumbers from '../data/emergency_numbers.json';

const APP_VERSION = '2.0.0';

export default function SettingsScreen() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  // Emergency contact
  const [contactName, setContactName] = useState(
    () => JSON.parse(localStorage.getItem('sos_contact') || '{}').name || ''
  );
  const [contactPhone, setContactPhone] = useState(
    () => JSON.parse(localStorage.getItem('sos_contact') || '{}').phone || ''
  );
  const [contactSaved, setContactSaved] = useState(false);

  // Crash detection
  const [crashEnabled, setCrashEnabled] = useState(
    () => localStorage.getItem('crash_detection_enabled') !== 'false'
  );
  const [sensitivity, setSensitivity] = useState(
    () => localStorage.getItem('crash_sensitivity') || 'medium'
  );
  const [motionPermission, setMotionPermission] = useState('unknown');

  // Offline data
  const [facilityCount, setFacilityCount] = useState(0);
  const [lastSync, setLastSync] = useState(null);
  const [mapCached, setMapCached] = useState(false);
  const [downloadingMap, setDownloadingMap] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(null);
  const [downloadMode, setDownloadMode] = useState(null); // 'local' | 'country' | 'all' | null

  // Country
  const [country, setCountry] = useState(
    () => localStorage.getItem('safereach_country') || 'BD'
  );

  useEffect(() => {
    getFacilityCount().then(setFacilityCount);
    getLastSync().then(setLastSync);
    getMapCacheStatus().then(setMapCached);

    if (typeof DeviceMotionEvent === 'undefined') {
      setMotionPermission('unavailable');
    } else if (typeof DeviceMotionEvent.requestPermission === 'function') {
      setMotionPermission('needs_request');
    } else {
      setMotionPermission('granted');
    }
  }, []);

  function handleSaveContact() {
    if (!contactName.trim() || !contactPhone.trim()) return;
    localStorage.setItem('sos_contact', JSON.stringify({ name: contactName.trim(), phone: contactPhone.trim() }));
    setContactSaved(true);
    setTimeout(() => setContactSaved(false), 2500);
  }

  function handleTestSMS() {
    const contact = JSON.parse(localStorage.getItem('sos_contact') || '{}');
    if (!contact.phone) return;
    window.location.href = `sms:${contact.phone}?body=TEST: SafeReach emergency contact test. If you receive this, the system is working correctly.`;
  }

  function handleCrashToggle() {
    const newVal = !crashEnabled;
    setCrashEnabled(newVal);
    localStorage.setItem('crash_detection_enabled', String(newVal));
  }

  function handleSensitivityChange(level) {
    setSensitivity(level);
    localStorage.setItem('crash_sensitivity', level);
  }

  async function handleRequestMotionPermission() {
    const result = await requestMotionPermission();
    setMotionPermission(result);
  }

  async function handleDownloadMap(mode) {
    if (!navigator.onLine) return;
    setDownloadingMap(true);
    setDownloadMode(mode);

    try {
      if (mode === 'local') {
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            async (pos) => {
              const { latitude, longitude } = pos.coords;
              await prewarmLocalArea(latitude, longitude, (f, tot) => setDownloadProgress({ f, tot }));
              finishDownload();
            },
            async () => {
              // Fallback to active country bounds if GPS fails
              const bounds = bimstecBounds.find((b) => b.country_code === country);
              if (bounds) await prewarmTiles(bounds, (f, tot) => setDownloadProgress({ f, tot }));
              finishDownload();
            },
            { timeout: 8000 }
          );
        } else {
          // Fallback
          const bounds = bimstecBounds.find((b) => b.country_code === country);
          if (bounds) await prewarmTiles(bounds, (f, tot) => setDownloadProgress({ f, tot }));
          finishDownload();
        }
      } else if (mode === 'all') {
        await prewarmAllCountries((f, tot) => setDownloadProgress({ f, tot }));
        finishDownload();
      } else {
        // Active country bounds
        const bounds = bimstecBounds.find((b) => b.country_code === country);
        if (bounds) {
          await prewarmTiles(bounds, (f, tot) => setDownloadProgress({ f, tot }));
        }
        finishDownload();
      }
    } catch (err) {
      console.warn('Map download failed:', err);
      finishDownload();
    }
  }

  function finishDownload() {
    setDownloadingMap(false);
    setDownloadProgress(null);
    setDownloadMode(null);
    setMapCached(true);
  }

  function handleLanguageChange(code) {
    i18n.changeLanguage(code);
    localStorage.setItem('safereach_lang', code);
  }

  function handleCountryChange(code) {
    setCountry(code);
    localStorage.setItem('safereach_country', code);
  }

  const currentLang = i18n.language?.split('-')[0] || 'en';
  const hasContact = contactName.trim() && contactPhone.trim();

  return (
    <div className="screen" style={{ background: 'var(--bg-primary)' }}>
      {/* ── Top bar ── */}
      <header className="topbar">
        <button
          onClick={() => navigate(-1)}
          className="touch-target flex items-center gap-1"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
          id="btn-settings-back"
        >
          <ChevronLeft size={22} />
        </button>
        <span className="text-h4">{t('settings')}</span>
        <div style={{ width: 40 }} />
      </header>

      <main className="flex-1 flex flex-col pb-10 overflow-y-auto px-5 pt-4" style={{ gap: 14 }}>

        {/* ── Section 1: Emergency Contact ── */}
        <SettingsSection
          icon={<User size={17} />}
          title={t('emergency_contact')}
          hint={hasContact ? `→ ${contactName}` : 'Not configured'}
          hintColor={hasContact ? 'var(--stable)' : 'var(--serious)'}
        >
          <div className="flex flex-col gap-3">
            <input
              id="input-contact-name"
              className="sr-input"
              placeholder={t('contact_name')}
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
            />
            <input
              id="input-contact-phone"
              className="sr-input"
              placeholder={t('contact_phone')}
              type="tel"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
            />
            <div className="flex gap-2">
              <button
                id="btn-save-contact"
                className="btn-primary flex-1"
                style={{ padding: '13px 16px', fontSize: 15 }}
                onClick={handleSaveContact}
              >
                {contactSaved ? (
                  <><CheckCircle2 size={16} /> Saved!</>
                ) : (
                  t('save_contact')
                )}
              </button>
              <button
                id="btn-test-sms"
                className="btn-ghost"
                style={{ padding: '13px 16px', fontSize: 14 }}
                onClick={handleTestSMS}
                disabled={!contactPhone}
              >
                <Send size={15} />
                {t('test_sms')}
              </button>
            </div>
          </div>
        </SettingsSection>

        {/* ── Section 2: Crash Detection ── */}
        <SettingsSection
          icon={<Activity size={17} />}
          title={t('crash_detection')}
          hint={crashEnabled ? 'Active' : 'Off'}
          hintColor={crashEnabled ? 'var(--stable)' : 'var(--text-tertiary)'}
        >
          <p className="text-label mb-4" style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            {t('crash_detection_desc')}
          </p>

          {/* Toggle row */}
          <div
            className="flex items-center justify-between rounded-xl p-4"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
          >
            <span className="text-body" style={{ fontWeight: 500 }}>Enable crash detection</span>
            <label className="toggle" htmlFor="toggle-crash">
              <input
                id="toggle-crash"
                type="checkbox"
                checked={crashEnabled}
                onChange={handleCrashToggle}
                disabled={motionPermission === 'unavailable'}
              />
              <span className="toggle-slider" />
            </label>
          </div>

          {/* iOS permission request */}
          {motionPermission === 'needs_request' && (
            <button
              id="btn-request-motion"
              className="btn-outline w-full"
              style={{ padding: '12px 16px', fontSize: 15, marginTop: 10 }}
              onClick={handleRequestMotionPermission}
            >
              {t('request_permission')}
            </button>
          )}
          {motionPermission === 'unavailable' && (
            <div className="flex items-center gap-2 mt-3">
              <AlertCircle size={15} color="var(--text-tertiary)" />
              <p className="text-label" style={{ color: 'var(--text-tertiary)' }}>
                Motion sensor not available on this device
              </p>
            </div>
          )}
          {motionPermission === 'denied' && (
            <div className="flex items-center gap-2 mt-3">
              <AlertCircle size={15} color="var(--critical)" />
              <p className="text-label" style={{ color: 'var(--critical)' }}>
                Permission denied — enable in device settings
              </p>
            </div>
          )}

          {/* Sensitivity — pill selector */}
          {crashEnabled && motionPermission !== 'unavailable' && (
            <div style={{ marginTop: 14 }}>
              <div className="text-label mb-2" style={{ color: 'var(--text-secondary)' }}>
                {t('sensitivity')}
              </div>
              <div
                className="flex"
                style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: 4,
                  gap: 4,
                }}
              >
                {['low', 'medium', 'high'].map((level) => (
                  <button
                    key={level}
                    id={`sensitivity-${level}`}
                    onClick={() => handleSensitivityChange(level)}
                    style={{
                      flex: 1,
                      borderRadius: 8,
                      padding: '9px 0',
                      fontSize: 13,
                      fontWeight: 600,
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      background: sensitivity === level
                        ? 'var(--accent)'
                        : 'transparent',
                      color: sensitivity === level ? '#fff' : 'var(--text-secondary)',
                      boxShadow: sensitivity === level ? 'var(--shadow-xs)' : 'none',
                    }}
                  >
                    {t(`sensitivity_${level}`)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </SettingsSection>

        {/* ── Section 3: Language ── */}
        <SettingsSection icon={<Globe size={17} />} title={t('language')}>
          <div className="grid grid-cols-2 gap-2">
            {LANGUAGES.map((lang) => {
              const isActive = currentLang === lang.code;
              return (
                <button
                  key={lang.code}
                  id={`lang-${lang.code}`}
                  onClick={() => handleLanguageChange(lang.code)}
                  style={{
                    borderRadius: 'var(--radius-lg)',
                    padding: '14px 16px',
                    textAlign: 'left',
                    background: isActive ? 'var(--accent-light)' : 'var(--bg-elevated)',
                    border: `${isActive ? '2px' : '1px'} solid ${isActive ? 'var(--accent)' : 'var(--border)'}`,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    boxShadow: isActive ? 'var(--shadow-xs)' : 'none',
                  }}
                >
                  <div
                    className="text-h4"
                    style={{ color: isActive ? 'var(--accent)' : 'var(--text-primary)', marginBottom: 2 }}
                  >
                    {lang.native}
                  </div>
                  <div className="text-label">{lang.label}</div>
                </button>
              );
            })}
          </div>
        </SettingsSection>

        {/* ── Section 4: Country Override ── */}
        <SettingsSection icon={<MapPin size={17} />} title={t('country_override')}>
          <div className="flex flex-col gap-2">
            {emergencyNumbers.map((c) => {
              const isActive = country === c.country_code;
              return (
                <button
                  key={c.country_code}
                  id={`country-override-${c.country_code}`}
                  onClick={() => handleCountryChange(c.country_code)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    borderRadius: 'var(--radius-md)',
                    padding: '12px 14px',
                    background: isActive ? 'var(--accent-light)' : 'var(--bg-elevated)',
                    border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  <span style={{ fontSize: 20 }}>{c.flag}</span>
                  <span
                    style={{
                      fontSize: 15,
                      fontWeight: isActive ? 600 : 400,
                      color: isActive ? 'var(--accent)' : 'var(--text-primary)',
                      flex: 1,
                      textAlign: 'left',
                    }}
                  >
                    {c.country_name}
                  </span>
                  {isActive && (
                    <CheckCircle2 size={16} color="var(--accent)" />
                  )}
                </button>
              );
            })}
          </div>
        </SettingsSection>

        {/* ── Section 5: Offline Data ── */}
        <SettingsSection
          icon={<Database size={17} />}
          title={t('offline_data')}
          hint={mapCached ? 'Map cached' : 'Map not cached'}
          hintColor={mapCached ? 'var(--stable)' : 'var(--serious)'}
        >
          {/* Data status rows */}
          <div
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden',
              marginBottom: 14,
            }}
          >
            <InfoRow label={t('facilities_loaded')} value={`${facilityCount} facilities`} />
            <div style={{ height: 1, background: 'var(--border)' }} />
            <InfoRow
              label={t('last_synced')}
              value={lastSync ? new Date(lastSync).toLocaleDateString() : 'Never'}
            />
            <div style={{ height: 1, background: 'var(--border)' }} />
            <InfoRow
              label={t('map_cached')}
              value={mapCached ? t('map_cached_yes') : t('map_cached_no')}
              valueColor={mapCached ? 'var(--stable)' : 'var(--serious)'}
            />
          </div>

          <div className="flex flex-col gap-2.5">
            {/* Button 1: Local Area Map */}
            <button
              id="btn-download-map-local"
              className={downloadingMap && downloadMode === 'local' ? 'btn-outline' : 'btn-primary'}
              style={{
                padding: '12px 16px',
                fontSize: 14,
                opacity: downloadingMap && downloadMode !== 'local' ? 0.4 : (!navigator.onLine ? 0.7 : 1),
              }}
              onClick={() => handleDownloadMap('local')}
              disabled={downloadingMap || !navigator.onLine}
            >
              {navigator.onLine ? (
                downloadingMap && downloadMode === 'local' ? (
                  <>
                    <span>⬇ Caching local coordinates...</span>
                    {downloadProgress && (
                      <span className="text-label" style={{ color: 'inherit', marginLeft: 4 }}>
                        {Math.round((downloadProgress.f / downloadProgress.tot) * 100)}%
                      </span>
                    )}
                  </>
                ) : (
                  <>Download Current Location Map</>
                )
              ) : (
                <><WifiOff size={16} /> Connect to download</>
              )}
            </button>

            {/* Button 2: Selected Country Map */}
            <button
              id="btn-download-map-country"
              className={downloadingMap && downloadMode === 'country' ? 'btn-outline' : 'btn-primary'}
              style={{
                padding: '12px 16px',
                fontSize: 14,
                opacity: downloadingMap && downloadMode !== 'country' ? 0.4 : (!navigator.onLine ? 0.7 : 1),
              }}
              onClick={() => handleDownloadMap('country')}
              disabled={downloadingMap || !navigator.onLine}
            >
              {navigator.onLine ? (
                downloadingMap && downloadMode === 'country' ? (
                  <>
                    <span>⬇ Caching country bounds...</span>
                    {downloadProgress && (
                      <span className="text-label" style={{ color: 'inherit', marginLeft: 4 }}>
                        {Math.round((downloadProgress.f / downloadProgress.tot) * 100)}%
                      </span>
                    )}
                  </>
                ) : (
                  <>Download {emergencyNumbers.find((e) => e.country_code === country)?.country_name || 'Active Country'} Map</>
                )
              ) : (
                <><WifiOff size={16} /> Connect to download</>
              )}
            </button>

            {/* Button 3: All Countries Map */}
            <button
              id="btn-download-map-all"
              className={downloadingMap && downloadMode === 'all' ? 'btn-outline' : 'btn-primary'}
              style={{
                padding: '12px 16px',
                fontSize: 14,
                opacity: downloadingMap && downloadMode !== 'all' ? 0.4 : (!navigator.onLine ? 0.7 : 1),
              }}
              onClick={() => handleDownloadMap('all')}
              disabled={downloadingMap || !navigator.onLine}
            >
              {navigator.onLine ? (
                downloadingMap && downloadMode === 'all' ? (
                  <>
                    <span>⬇ Caching all BIMSTEC maps...</span>
                    {downloadProgress && (
                      <span className="text-label" style={{ color: 'inherit', marginLeft: 4 }}>
                        {Math.round((downloadProgress.f / downloadProgress.tot) * 100)}%
                      </span>
                    )}
                  </>
                ) : (
                  <>Download Map for All Countries</>
                )
              ) : (
                <><WifiOff size={16} /> Connect to download</>
              )}
            </button>
          </div>
        </SettingsSection>

        {/* ── Section 6: About ── */}
        <SettingsSection icon={<Info size={17} />} title={t('about')}>
          <div
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden',
              marginBottom: 14,
            }}
          >
            <InfoRow label={t('version')} value={`v${APP_VERSION}`} />
            <div style={{ height: 1, background: 'var(--border)' }} />
            <InfoRow label="Data Sources" value="OpenStreetMap (ODbL)" />
            <div style={{ height: 1, background: 'var(--border)' }} />
            <InfoRow label="First Aid" value="WHO Manual 2024" />
            <div style={{ height: 1, background: 'var(--border)' }} />
            <InfoRow label="Submitted for" value="Road Safety Hackathon 2026" />
          </div>
          <p className="text-label" style={{ color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
            SafeReach is open-source. Emergency numbers verified from official government sources.
            First-aid content adapted from WHO materials (public domain). Facility data from
            OpenStreetMap (ODbL license).
          </p>
        </SettingsSection>

      </main>
    </div>
  );
}

function SettingsSection({ icon, title, hint, hintColor, children }) {
  return (
    <div className="settings-section">
      <div className="settings-section-header">
        <span style={{ color: 'var(--accent)', display: 'flex', flexShrink: 0 }}>{icon}</span>
        <span className="text-h4" style={{ flex: 1 }}>{title}</span>
        {hint && (
          <span
            className="text-label"
            style={{ color: hintColor || 'var(--text-tertiary)', fontWeight: 600 }}
          >
            {hint}
          </span>
        )}
      </div>
      <div className="settings-section-body">
        {children}
      </div>
    </div>
  );
}

function InfoRow({ label, value, valueColor }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '11px 14px',
      }}
    >
      <span className="text-label" style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span className="text-label" style={{ color: valueColor || 'var(--text-primary)', fontWeight: 600 }}>
        {value}
      </span>
    </div>
  );
}
