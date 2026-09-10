import { updateIncidentSyncStatus, getPendingIncidents } from './offlineDB.js';

export const TRIAGE_SYNC_EVENT = 'triage_sync_updated';

/**
 * Get the backend API URL from environment or fallback to empty string (same-origin)
 * @returns {string}
 */
export function getApiUrl() {
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  return '';
}

/**
 * Synchronize a single triage incident with the backend.
 * Idempotent: passes incident.session_id as the primary key.
 * Never throws: always returns a structured sync result.
 * @param {Object} incident
 * @param {Object} [options]
 * @param {number} [options.timeoutMs=5000]
 * @returns {Promise<{ success: boolean, status: string, sessionId?: string, incidentId?: number|string, error?: string }>}
 */
export async function syncTriageIncident(incident, { timeoutMs = 5000 } = {}) {
  // Check online connectivity (explicitly false when offline in browsers)
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    if (incident.id) {
      await updateIncidentSyncStatus(incident.id, 'pending', {
        sync_error: 'Offline — waiting for network',
      });
    }
    return { success: false, status: 'offline', incidentId: incident.id };
  }

  const payload = {
    id: incident.session_id || undefined,
    country_code: incident.country_code ? String(incident.country_code).trim().toUpperCase() : null,
    severity: incident.severity,
    facility_id: incident.facility_id || null,
    was_offline: typeof incident.was_offline === 'boolean' ? incident.was_offline : false,
    created_at: incident.created_at || new Date().toISOString(),
    score: typeof incident.score === 'number' ? incident.score : null,
    summary: incident.summary || null,
    flags: Array.isArray(incident.flags) ? incident.flags : [],
    responses: Array.isArray(incident.responses) ? incident.responses : [],
  };

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

  try {
    const url = `${getApiUrl()}/api/v1/triage/sessions`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller ? controller.signal : undefined,
    });

    clearTimeout(timer);
    if (response.ok) {
      let data;
      try {
        data = await response.json();
      } catch {
        const errorMsg = 'Invalid backend response: malformed JSON';
        if (incident.id) {
          await updateIncidentSyncStatus(incident.id, 'failed', { sync_error: errorMsg });
        }
        dispatchSyncEvent({ incidentId: incident.id, status: 'failed', error: errorMsg });
        return { success: false, status: 'validation_error', error: errorMsg, incidentId: incident.id };
      }

      if (!data || typeof data !== 'object') {
        const errorMsg = 'Invalid backend response: expected object';
        if (incident.id) {
          await updateIncidentSyncStatus(incident.id, 'failed', { sync_error: errorMsg });
        }
        dispatchSyncEvent({ incidentId: incident.id, status: 'failed', error: errorMsg });
        return { success: false, status: 'validation_error', error: errorMsg, incidentId: incident.id };
      }

      if (data.success !== true) {
        const errorMsg = 'Invalid backend response: success is not true';
        if (incident.id) {
          await updateIncidentSyncStatus(incident.id, 'failed', { sync_error: errorMsg });
        }
        dispatchSyncEvent({ incidentId: incident.id, status: 'failed', error: errorMsg });
        return { success: false, status: 'validation_error', error: errorMsg, incidentId: incident.id };
      }

      if (typeof data.session_id !== 'string' || !data.session_id.trim()) {
        const errorMsg = 'Invalid backend response: missing or empty session_id';
        if (incident.id) {
          await updateIncidentSyncStatus(incident.id, 'failed', { sync_error: errorMsg });
        }
        dispatchSyncEvent({ incidentId: incident.id, status: 'failed', error: errorMsg });
        return { success: false, status: 'validation_error', error: errorMsg, incidentId: incident.id };
      }

      if (data.status !== 'created' && data.status !== 'already_synced') {
        const errorMsg = `Invalid backend response: unexpected status "${data.status}"`;
        if (incident.id) {
          await updateIncidentSyncStatus(incident.id, 'failed', { sync_error: errorMsg });
        }
        dispatchSyncEvent({ incidentId: incident.id, status: 'failed', error: errorMsg });
        return { success: false, status: 'validation_error', error: errorMsg, incidentId: incident.id };
      }

      const sessionId = data.session_id;

      if (incident.id) {
        await updateIncidentSyncStatus(incident.id, 'synced', {
          synced_at: new Date().toISOString(),
          backend_session_id: sessionId,
          sync_error: null,
        });
      }

      dispatchSyncEvent({
        incidentId: incident.id,
        sessionId,
        status: 'synced',
      });

      return {
        success: true,
        status: data.status,
        sessionId,
        incidentId: incident.id,
      };
    } else {
      const errorMsg = `Server responded with ${response.status}`;
      if (incident.id) {
        await updateIncidentSyncStatus(incident.id, 'failed', {
          sync_error: errorMsg,
        });
      }

      dispatchSyncEvent({
        incidentId: incident.id,
        status: 'failed',
        error: errorMsg,
      });
      return {
        success: false,
        status: 'failed',
        error: errorMsg,
        incidentId: incident.id,
      };
    }
  } catch (err) {
    clearTimeout(timer);

    const errorMsg = err.name === 'AbortError' ? 'Sync timed out' : err.message || 'Network error';

    if (incident.id) {
      await updateIncidentSyncStatus(incident.id, 'pending', {
        sync_error: errorMsg,
      });
    }

    dispatchSyncEvent({
      incidentId: incident.id,
      status: 'pending',
      error: errorMsg,
    });

    return {
      success: false,
      status: 'network_error',
      error: errorMsg,
      incidentId: incident.id,
    };
  }
}

/**
 * Synchronize all pending/failed incidents
 * @returns {Promise<{ success: boolean, total: number, synced: number, failed: number, status?: string }>}
 */
export async function syncPendingIncidents() {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { success: false, status: 'offline', total: 0, synced: 0, failed: 0 };
  }

  const pending = await getPendingIncidents();
  if (!pending || pending.length === 0) {
    return { success: true, total: 0, synced: 0, failed: 0 };
  }

  let synced = 0;
  let failed = 0;

  for (const inc of pending) {
    const res = await syncTriageIncident(inc);
    if (res.success) {
      synced++;
    } else {
      failed++;
    }
  }

  return {
    success: true,
    total: pending.length,
    synced,
    failed,
  };
}

let _listenerRegistered = false;

/**
 * Initialize automatic sync listener when browser comes back online.
 * Safe to call multiple times.
 */
export function initTriageSyncListener() {
  if (_listenerRegistered || typeof window === 'undefined') return;

  window.addEventListener('online', () => {
    syncPendingIncidents().catch((err) => {
      console.warn('[SafeReach] Background triage sync error:', err);
    });
  });

  _listenerRegistered = true;
}

function dispatchSyncEvent(detail) {
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    try {
      window.dispatchEvent(new CustomEvent(TRIAGE_SYNC_EVENT, { detail }));
    } catch {}
  }
}

export default {
  syncTriageIncident,
  syncPendingIncidents,
  initTriageSyncListener,
  TRIAGE_SYNC_EVENT,
};
