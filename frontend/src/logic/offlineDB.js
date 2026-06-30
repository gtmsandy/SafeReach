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
 * Save a triage session
 * @param {Object} session
 */
export async function saveTriageSession(session) {
  return db.triage_sessions.add({
    ...session,
    created_at: new Date().toISOString(),
  });
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
