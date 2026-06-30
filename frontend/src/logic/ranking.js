/**
 * SafeReach Facility Ranking Algorithm
 * Pure JavaScript — no API, works 100% offline.
 * 
 * Scores each facility on 4 dimensions (max 100 pts), returns top 3.
 */

import { haversine } from './haversine.js';

/**
 * Type affinity scores by severity
 * Higher = more appropriate for this severity level
 */
const TYPE_SCORES = {
  critical: {
    trauma_center: 30,
    hospital: 20,
    ambulance: 15,
    police: 5,
    blood_bank: 10,
    clinic: 2,
    towing: 0,
    puncture_shop: 0,
  },
  serious: {
    hospital: 30,
    trauma_center: 25,
    ambulance: 20,
    blood_bank: 10,
    police: 5,
    clinic: 8,
    towing: 0,
    puncture_shop: 0,
  },
  stable: {
    hospital: 25,
    clinic: 30,
    police: 15,
    ambulance: 10,
    trauma_center: 20,
    blood_bank: 5,
    towing: 10,
    puncture_shop: 8,
  },
};

/**
 * Trauma level scoring — level 1 = highest capability
 * Only applies when severity is critical/serious
 */
function getTraumaScore(traumaLevel, severity) {
  if (!traumaLevel) return 0;
  if (severity === 'stable') return 0;
  const scores = { 1: 20, 2: 12, 3: 5 };
  return scores[traumaLevel] || 0;
}

/**
 * Score a single facility against the current context
 * @param {Object} facility
 * @param {'critical'|'serious'|'stable'} severity
 * @param {number} userLat
 * @param {number} userLng
 * @returns {Object} facility with totalScore and distance_km added
 */
export function scoreFeature(facility, severity, userLat, userLng) {
  const distance = haversine(userLat, userLng, facility.lat, facility.lng);

  // Distance score: 0-40 pts, drops 2 pts per km
  const distScore = Math.max(0, 40 - distance * 2);

  // Type affinity score: 0-30 pts
  const typeMap = TYPE_SCORES[severity] || TYPE_SCORES.stable;
  const typeScore = typeMap[facility.facility_type] || 0;

  // Trauma level score: 0-20 pts (critical/serious only)
  const traumaScore = getTraumaScore(facility.trauma_level, severity);

  // Verification score: 0-10 pts
  const verifyScore = facility.verified ? 10 : 0;

  const totalScore = distScore + typeScore + traumaScore + verifyScore;

  return {
    ...facility,
    totalScore,
    distance_km: Math.round(distance * 10) / 10,
  };
}

/**
 * Rank facilities and return top 3 for a given severity + user location
 * @param {Array} facilities - array of facility objects
 * @param {'critical'|'serious'|'stable'} severity
 * @param {number} userLat
 * @param {number} userLng
 * @param {number} [radiusKm=20] - max search radius
 * @returns {Array} top 3 scored facilities
 */
export function rankFacilities(facilities, severity, userLat, userLng, radiusKm = 20) {
  const scored = facilities.map((f) => scoreFeature(f, severity, userLat, userLng));
  
  // Try to find facilities within search radius
  let filtered = scored.filter((f) => f.distance_km <= radiusKm);
  
  // Fallback: If testing from outside bounds (e.g. India checking Bangladesh),
  // ignore search radius and return overall nearest/best facilities.
  if (filtered.length === 0) {
    filtered = scored;
  }

  return filtered.sort((a, b) => b.totalScore - a.totalScore).slice(0, 3);
}

export default { scoreFeature, rankFacilities };
