/**
 * SafeReach Map Filtering Logic
 * Pure JavaScript facility filtering and count helpers.
 * Fully offline, deterministic, and isolated to active-country facilities.
 */

export const FILTER_TYPES = {
  ALL: 'all',
  HOSPITAL: 'hospital',
  POLICE: 'police',
  TOWING: 'towing',
};

/**
 * Filter facilities by category.
 *
 * @param {Array<Object>} facilities - Facilities for the active country
 * @param {string} selectedFilter - 'all' | 'hospital' | 'police' | 'towing'
 * @returns {Array<Object>} Filtered facility records
 */
export function filterFacilities(facilities, selectedFilter) {
  if (!Array.isArray(facilities)) return [];
  if (!selectedFilter || selectedFilter === FILTER_TYPES.ALL) {
    return facilities;
  }
  return facilities.filter((f) => f && f.facility_type === selectedFilter);
}

/**
 * Compute facility counts by filter category.
 *
 * @param {Array<Object>} facilities
 * @returns {{ all: number, hospital: number, police: number, towing: number }}
 */
export function getFilterCounts(facilities) {
  if (!Array.isArray(facilities)) {
    return { all: 0, hospital: 0, police: 0, towing: 0 };
  }
  return {
    all: facilities.length,
    hospital: facilities.filter((f) => f && f.facility_type === FILTER_TYPES.HOSPITAL).length,
    police: facilities.filter((f) => f && f.facility_type === FILTER_TYPES.POLICE).length,
    towing: facilities.filter((f) => f && f.facility_type === FILTER_TYPES.TOWING).length,
  };
}

export default {
  FILTER_TYPES,
  filterFacilities,
  getFilterCounts,
};
