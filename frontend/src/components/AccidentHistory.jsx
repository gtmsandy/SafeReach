import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ChevronLeft,
  Trash2,
  AlertTriangle,
  ChevronRight,
  Stethoscope,
  Activity,
  MapPin,
  Clock,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  getIncidents,
  deleteIncident,
} from '../logic/offlineDB';
import { syncTriageIncident, syncPendingIncidents, TRIAGE_SYNC_EVENT } from '../logic/triageSync';
import emergencyNumbers from '../data/emergency_numbers.json';

const SEVERITY_THEME = {
  critical: {
    bg: 'var(--critical-bg)',
    color: 'var(--critical-text)',
    border: 'var(--critical-border)',
    emoji: '🚨',
  },
  serious: {
    bg: 'var(--serious-bg)',
    color: 'var(--serious-text)',
    border: 'var(--serious-border)',
    emoji: '⚠️',
  },
  stable: {
    bg: 'var(--stable-bg)',
    color: 'var(--stable-text)',
    border: 'var(--stable-border)',
    emoji: '✅',
  },
};

export default function AccidentHistory() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    loadIncidents();

    function handleSyncUpdate() {
      getIncidents().then((data) => setIncidents(data || [])).catch(() => {});
    }
    window.addEventListener(TRIAGE_SYNC_EVENT, handleSyncUpdate);
    return () => {
      window.removeEventListener(TRIAGE_SYNC_EVENT, handleSyncUpdate);
    };
  }, []);
  async function loadIncidents() {
    setLoading(true);
    try {
      const data = await getIncidents();
      setIncidents(data || []);
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        syncPendingIncidents().catch(() => {});
      }
    } catch (err) {
      console.error('[SafeReach] Failed to load incidents:', err);
    }
    setLoading(false);
  }

  async function handleDelete(id, e) {
    e.stopPropagation();
    const confirmed = window.confirm(
      t('confirm_delete_incident') || 'Are you sure you want to delete this incident record?'
    );
    if (!confirmed) return;

    try {
      await deleteIncident(id);
      await loadIncidents();
    } catch (err) {
      console.error('[SafeReach] Failed to delete incident:', err);
    }
  }

  function getCountryMeta(code) {
    return (
      emergencyNumbers.find((e) => e.country_code === code) || {
        country_name: code || 'BIMSTEC Region',
        flag: '📍',
      }
    );
  }

  function formatDateTime(isoStr) {
    if (!isoStr) return '—';
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return isoStr;
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoStr;
    }
  }

  return (
    <div
      className="screen"
      style={{
        minHeight: '100vh',
        background: 'var(--bg-primary)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* ── Top Bar ── */}
      <header className="topbar">
        <button
          id="btn-history-back"
          onClick={() => navigate(-1)}
          className="touch-target flex items-center gap-1"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-secondary)',
          }}
          aria-label={t('back') || 'Go Back'}
        >
          <ChevronLeft size={24} />
        </button>

        <div className="flex items-center gap-2">
          <Activity size={19} color="var(--accent)" />
          <h1 className="text-h4" style={{ margin: 0 }}>
            {t('accident_history') || 'Accident History'}
          </h1>
        </div>

        <div
          style={{
            minWidth: 40,
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
          }}
        >
          {incidents.length > 0 && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--accent)',
                background: 'var(--accent-light)',
                padding: '4px 8px',
                borderRadius: 999,
              }}
            >
              {incidents.length}
            </span>
          )}
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="flex-1 flex flex-col px-4 sm:px-5 pt-4 pb-8 gap-4">
        {loading ? (
          <div
            className="flex-1 flex items-center justify-center py-16"
            style={{ color: 'var(--text-tertiary)' }}
          >
            <Clock size={20} className="animate-spin" style={{ marginRight: 8 }} />
            <span>Loading incident vault...</span>
          </div>
        ) : incidents.length === 0 ? (
          <div
            className="flex-1 flex flex-col items-center justify-center text-center py-16 px-4"
            style={{ animation: 'scaleIn 0.2s ease' }}
          >
            <div
              style={{
                width: 68,
                height: 68,
                borderRadius: '50%',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 30,
                marginBottom: 16,
              }}
            >
              📋
            </div>
            <h2 className="text-h3" style={{ marginBottom: 6 }}>
              {t('no_accident_history') || 'No accident history yet'}
            </h2>
            <p
              className="text-body"
              style={{
                color: 'var(--text-secondary)',
                maxWidth: 320,
                marginBottom: 24,
                lineHeight: 1.5,
              }}
            >
              {t('no_accident_history_desc') ||
                'Completed triage sessions and trauma reports will be securely saved here offline.'}
            </p>
            <button
              id="btn-history-start-triage"
              onClick={() => navigate('/triage')}
              className="btn-primary"
              style={{ padding: '12px 24px', borderRadius: 12 }}
            >
              {t('start_triage') || 'Start Triage'}
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <span
                className="text-micro"
                style={{ color: 'var(--text-tertiary)', fontWeight: 700 }}
              >
                {(t('incidents') || 'Incidents').toUpperCase()} ({incidents.length})
              </span>
              <span
                style={{
                  fontSize: 11,
                  color: 'var(--stable)',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <span>🔒</span>
                {t('saved_locally') || 'Saved Locally'}
              </span>
            </div>

            <div className="flex flex-col gap-3">
              {incidents.map((incident) => {
                const theme = SEVERITY_THEME[incident.severity] || SEVERITY_THEME.stable;
                const countryMeta = getCountryMeta(incident.country_code);
                const isExpanded = expandedId === incident.id;
                const severityLabel =
                  t(`severity_${incident.severity}`) ||
                  incident.severity.charAt(0).toUpperCase() + incident.severity.slice(1);

                return (
                  <article
                    key={incident.id}
                    className="sr-card"
                    style={{
                      background: 'var(--bg-card)',
                      border: `1px solid ${isExpanded ? 'var(--border-strong)' : 'var(--border)'}`,
                      borderRadius: 'var(--radius-xl)',
                      padding: '16px',
                      boxShadow: 'var(--shadow-xs)',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {/* Header Row: Severity Badge + Date/Time + Delete */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          background: theme.bg,
                          color: theme.color,
                          border: `1px solid ${theme.border}`,
                          borderRadius: 8,
                          padding: '4px 10px',
                          fontSize: 12,
                          fontWeight: 700,
                        }}
                      >
                        <span>{theme.emoji}</span>
                        <span>{severityLabel}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          style={{
                            fontSize: 11,
                            color: 'var(--text-tertiary)',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {formatDateTime(incident.created_at)}
                        </span>

                        <button
                          id={`btn-delete-incident-${incident.id}`}
                          onClick={(e) => handleDelete(incident.id, e)}
                          className="touch-target flex items-center justify-center"
                          style={{
                            width: 32,
                            height: 32,
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'var(--text-tertiary)',
                            borderRadius: 6,
                          }}
                          aria-label={`${t('delete_incident') || 'Delete'} incident record`}
                          title={t('delete_incident') || 'Delete'}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    {/* Summary Description */}
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        lineHeight: 1.4,
                        marginBottom: 8,
                      }}
                    >
                      {incident.summary || `${severityLabel} Assessment`}
                    </div>

                    {/* Metadata Row: Country, Trauma Score, Location */}
                    <div
                      className="flex flex-wrap items-center gap-y-1 gap-x-3 text-label"
                      style={{ color: 'var(--text-secondary)', marginBottom: 10 }}
                    >
                      <div className="flex items-center gap-1">
                        <span>{countryMeta.flag}</span>
                        <span>{countryMeta.country_name}</span>
                      </div>

                      {typeof incident.score === 'number' && (
                        <div style={{ fontWeight: 600 }}>
                          {t('trauma_score') || 'Trauma Score'}: {incident.score}
                        </div>
                      )}

                      {incident.location && incident.location.lat && incident.location.lng ? (
                        <div className="flex items-center gap-1">
                          <MapPin size={12} />
                          <span>
                            {incident.location.lat.toFixed(3)}, {incident.location.lng.toFixed(3)}
                          </span>
                        </div>
                      ) : (
                        <div style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>
                          {t('location_unavailable') || 'Location unavailable'}
                        </div>
                      )}
                    </div>

                      {/* Sync Status Badge */}
                      <div
                        id={`sync-status-${incident.id}`}
                        className="flex items-center gap-1"
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color:
                            incident.sync_status === 'synced'
                              ? 'var(--stable)'
                              : incident.sync_status === 'failed'
                              ? 'var(--critical)'
                              : 'var(--serious)',
                        }}
                      >
                        {incident.sync_status === 'synced' ? (
                          <>
                            <span>☁️</span>
                            <span>{t('synced') || 'Synced'}</span>
                          </>
                        ) : incident.sync_status === 'failed' ? (
                          <>
                            <span>⚠️</span>
                            <span>{t('sync_failed') || 'Sync Failed'}</span>
                            <button
                              type="button"
                              id={`btn-retry-sync-${incident.id}`}
                              onClick={async (e) => {
                                e.stopPropagation();
                                await syncTriageIncident(incident);
                                await loadIncidents();
                              }}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--accent-bright)',
                                cursor: 'pointer',
                                fontSize: 11,
                                fontWeight: 700,
                                textDecoration: 'underline',
                                padding: 0,
                                marginLeft: 4,
                              }}
                            >
                              {t('retry') || 'Retry'}
                            </button>
                          </>
                        ) : (
                          <>
                            <span>⏳</span>
                            <span>{t('pending_sync') || 'Pending Sync'}</span>
                            <button
                              type="button"
                              id={`btn-retry-sync-${incident.id}`}
                              onClick={async (e) => {
                                e.stopPropagation();
                                await syncTriageIncident(incident);
                                await loadIncidents();
                              }}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--accent-bright)',
                                cursor: 'pointer',
                                fontSize: 11,
                                fontWeight: 700,
                                textDecoration: 'underline',
                                padding: 0,
                                marginLeft: 4,
                              }}
                            >
                              {t('sync_now') || 'Sync Now'}
                            </button>
                          </>
                        )}
                      </div>

                    {/* Clinical Warning Tags (e.g. NO_MOVE) */}
                    {Array.isArray(incident.flags) && incident.flags.length > 0 && (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          background: 'var(--critical-bg)',
                          border: '1px solid var(--critical-border)',
                          borderRadius: 8,
                          padding: '6px 10px',
                          fontSize: 11,
                          fontWeight: 700,
                          color: 'var(--critical-text)',
                          marginBottom: 10,
                        }}
                      >
                        <AlertTriangle size={14} style={{ flexShrink: 0 }} />
                        <span>Warning: {incident.flags.join(', ')} (Do Not Move Victim)</span>
                      </div>
                    )}

                    {/* Action Bar: First Aid Link & Details Toggle */}
                    <div
                      className="flex items-center justify-between pt-2 border-t"
                      style={{ borderColor: 'var(--border)' }}
                    >
                      {incident.first_aid_id ? (
                        <button
                          id={`btn-view-firstaid-${incident.id}`}
                          onClick={() => navigate(`/firstaid/${incident.first_aid_id}`)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 5,
                            color: 'var(--accent-bright)',
                            fontSize: 12,
                            fontWeight: 700,
                            padding: '6px 0',
                          }}
                        >
                          <Stethoscope size={14} />
                          <span>{t('view_first_aid') || 'View First Aid'}</span>
                          <ChevronRight size={14} />
                        </button>
                      ) : (
                        <div />
                      )}

                      <button
                        id={`btn-toggle-details-${incident.id}`}
                        onClick={() => setExpandedId(isExpanded ? null : incident.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          fontSize: 11,
                          fontWeight: 600,
                          color: 'var(--text-secondary)',
                          padding: '6px 0',
                        }}
                        aria-expanded={isExpanded}
                      >
                        <span>
                          {isExpanded
                            ? t('hide_details') || 'Hide Details'
                            : t('view_details') || 'View Details'}
                        </span>
                        {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      </button>
                    </div>

                    {/* Expanded Detail Panel */}
                    {isExpanded && (
                      <div
                        style={{
                          marginTop: 10,
                          paddingTop: 10,
                          borderTop: '1px dashed var(--border)',
                          fontSize: 12,
                        }}
                      >
                        <div
                          style={{
                            fontWeight: 700,
                            color: 'var(--text-primary)',
                            marginBottom: 6,
                          }}
                        >
                          {t('recorded_responses') || 'Recorded Responses'}
                        </div>

                        {Array.isArray(incident.responses) && incident.responses.length > 0 ? (
                          <div className="flex flex-col gap-1.5">
                            {incident.responses.map((r, idx) => (
                              <div
                                key={idx}
                                className="flex items-center justify-between"
                                style={{
                                  padding: '4px 8px',
                                  background: 'var(--bg-elevated)',
                                  borderRadius: 6,
                                  fontSize: 11,
                                }}
                              >
                                <span style={{ color: 'var(--text-secondary)' }}>
                                  {r.q_id
                                    ? `Question ${r.q_id.replace('q', '')}`
                                    : `Question ${idx + 1}`}
                                  :
                                </span>
                                <span
                                  style={{
                                    fontWeight: 600,
                                    color: 'var(--text-primary)',
                                    textTransform: 'capitalize',
                                  }}
                                >
                                  {r.option_id ? r.option_id.replace(/_/g, ' ') : '—'}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>
                            No question responses saved.
                          </div>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
