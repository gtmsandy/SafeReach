/**
 * SafeReach Offline Database (Dexie / IndexedDB)
 * Schema, seed logic, and query helpers — all offline.
 */

import Dexie from 'dexie';

export const db = new Dexie('SafeReach');

db.version(1).stores({
  facilities:          'id, country_code, facility_type, lat, lng, trauma_level',
  emergency_numbers:   'country_code',
  first_aid_protocols: 'id, severity',
  triage_sessions:     '++id, country_code, severity, created_at',
  sync_meta:           'key',
});

db.version(2).stores({
  incidents:           '++id, severity, created_at, country_code',
});

db.version(3).stores({
  incidents:           '++id, severity, created_at, country_code, sync_status, session_id',
});

/**
 * Generate a random UUID string (standard v4)
 * @returns {string}
 */
export function generateUUID() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

let _seeded = false;

/**
 * Seed the database from bundled JSON files on first launch.
 * Safe to call multiple times — skips if already seeded.
 */
export async function seedDatabase() {
  if (_seeded) return;

  try {
    const count = await db.facilities.count();
    if (count === 0) {
      const [facilities, emergency, firstaid] = await Promise.all([
        import('../data/bimstec_facilities.json'),
        import('../data/emergency_numbers.json'),
        import('../data/first_aid_protocols.json'),
      ]);

      await db.transaction('rw', db.facilities, db.emergency_numbers, db.first_aid_protocols, db.sync_meta, async () => {
        await db.facilities.bulkAdd(facilities.default);
        await db.emergency_numbers.bulkAdd(emergency.default);
        await db.first_aid_protocols.bulkAdd(firstaid.default);
        await db.sync_meta.put({ key: 'last_sync', value: new Date().toISOString() });
      });

      console.log('[SafeReach DB] Seeded with bundled data.');
    }
    _seeded = true;
  } catch (err) {
    console.warn('[SafeReach DB] Seed error:', err);
  }
}

/**
 * Get facilities for a country, optionally filtered by type
 * @param {string} countryCode
 * @param {string[]} [types]
 * @returns {Promise<Array>}
 */
export async function getFacilitiesByCountry(countryCode, types = null) {
  let query = db.facilities.where('country_code').equals(countryCode);
  const results = await query.toArray();
  if (types && types.length > 0) {
    return results.filter((f) => types.includes(f.facility_type));
  }
  return results;
}

/**
 * Get emergency numbers for a country
 * @param {string} countryCode
 * @returns {Promise<Object|null>}
 */
export async function getEmergencyNumbers(countryCode) {
  return db.emergency_numbers.get(countryCode);
}

/**
 * Get a first-aid protocol by id
 * @param {string} protocolId
 * @returns {Promise<Object|null>}
 */
export async function getProtocol(protocolId) {
  return db.first_aid_protocols.get(protocolId);
}

/**
 * Get all first-aid protocols
 * @returns {Promise<Array>}
 */
export async function getAllProtocols() {
  return db.first_aid_protocols.toArray();
}

/**
 * Save a completed incident to the local incident vault
 * @param {Object} incident
 * @returns {Promise<Object>}
 */
export async function saveIncident(incident) {
  if (!incident || !incident.severity) {
    throw new Error('Incident severity is required');
  }

  const record = {
    session_id: incident.session_id || generateUUID(),
    severity: String(incident.severity),
    score: typeof incident.score === 'number' ? incident.score : null,
    summary: (incident.summary || '').trim(),
    first_aid_id: incident.first_aid_id || null,
    flags: Array.isArray(incident.flags) ? incident.flags : [],
    responses: Array.isArray(incident.responses) ? incident.responses : [],
    country_code: incident.country_code || null,
    location: incident.location || null, // Never fabricate coordinates
    was_offline: typeof incident.was_offline === 'boolean' ? incident.was_offline : true,
    sync_status: incident.sync_status || 'pending',
    synced_at: incident.synced_at || null,
    sync_error: incident.sync_error || null,
    backend_session_id: incident.backend_session_id || null,
    created_at: incident.created_at || new Date().toISOString(),
  };

  const id = await db.incidents.add(record);
  return { ...record, id };
}

/**
 * Update incident synchronization status and metadata
 * @param {number|string} id
 * @param {'synced' | 'pending' | 'failed'} syncStatus
 * @param {Object} [meta]
 * @returns {Promise<number>}
 */
export async function updateIncidentSyncStatus(id, syncStatus, meta = {}) {
  const updates = { sync_status: syncStatus };
  if (meta.synced_at !== undefined) updates.synced_at = meta.synced_at;
  if (meta.sync_error !== undefined) updates.sync_error = meta.sync_error;
  if (meta.backend_session_id !== undefined) updates.backend_session_id = meta.backend_session_id;

  try {
    return await db.incidents.update(Number(id), updates);
  } catch (err) {
    console.error('[SafeReach DB] Failed to update incident sync status:', err);
    return 0;
  }
}

/**
 * Get all pending or failed incidents eligible for synchronization
 * @returns {Promise<Array>}
 */
export async function getPendingIncidents() {
  try {
    const all = await db.incidents.toArray();
    return all.filter((inc) => inc.sync_status === 'pending' || inc.sync_status === 'failed' || !inc.sync_status);
  } catch (err) {
    console.error('[SafeReach DB] Failed to get pending incidents:', err);
    return [];
  }
}

/**
 * Save a triage session (delegates to saveIncident and records in triage_sessions)
 * @param {Object} session
 */
export async function saveTriageSession(session) {
  try {
    await db.triage_sessions.add({
      country_code: session.country_code,
      severity: session.severity,
      was_offline: session.was_offline,
      created_at: new Date().toISOString(),
    });
  } catch {}
  return saveIncident(session);
}

/**
 * Retrieve all incidents from the local vault, newest first
 * Strictly based on the incidents store.
 * @returns {Promise<Array>}
 */
export async function getIncidents() {
  try {
    return await db.incidents.orderBy('id').reverse().toArray();
  } catch (err) {
    console.error('[SafeReach DB] Error loading incidents:', err);
    return [];
  }
}

/**
 * Retrieve a single incident by ID
 * @param {number|string} id
 * @returns {Promise<Object|null>}
 */
export async function getIncidentById(id) {
  return db.incidents.get(Number(id));
}

/**
 * Delete an individual incident from the local vault
 * @param {number|string} id
 * @returns {Promise<boolean>}
 */
export async function deleteIncident(id) {
  await db.incidents.delete(Number(id));
  return true;
}

/**
 * Get all facilities (all countries)
 * @returns {Promise<Array>}
 */
export async function getAllFacilities() {
  return db.facilities.toArray();
}

/**
 * Update facility verification status
 * @param {string} id
 * @param {boolean} verified
 */
export async function updateFacilityVerification(id, verified) {
  return db.facilities.update(id, { verified });
}

/**
 * Get last sync metadata
 * @returns {Promise<string|null>}
 */
export async function getLastSync() {
  const meta = await db.sync_meta.get('last_sync');
  return meta ? meta.value : null;
}

/**
 * Count facilities
 * @returns {Promise<number>}
 */
export async function getFacilityCount() {
  return db.facilities.count();
}

/**
 * Check if map tiles are likely cached (stored flag)
 */
export async function getMapCacheStatus() {
  const meta = await db.sync_meta.get('map_cached');
  return meta ? meta.value : false;
}

export async function setMapCacheStatus(value) {
  return db.sync_meta.put({ key: 'map_cached', value });
}

export default db;
