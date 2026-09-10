import test from 'node:test';
import assert from 'node:assert/strict';
import { filterFacilities, getFilterCounts } from '../mapFiltering.js';
import { rankFacilities } from '../ranking.js';

// Deterministic test fixtures
const bdFacilities = [
  { id: 'bd-h-1', name: 'Dhaka Medical College', facility_type: 'hospital', country_code: 'BD', lat: 23.7258, lng: 90.3975 },
  { id: 'bd-h-2', name: 'Kurmitola General Hospital', facility_type: 'hospital', country_code: 'BD', lat: 23.8222, lng: 90.4131 },
  { id: 'bd-p-1', name: 'Shahbagh Police Station', facility_type: 'police', country_code: 'BD', lat: 23.7380, lng: 90.3950 },
  { id: 'bd-b-1', name: 'Red Crescent Blood Bank', facility_type: 'blood_bank', country_code: 'BD', lat: 23.7400, lng: 90.4000 },
];

const inFacilities = []; // India has 0 records per Unit 3

const mixedCountryFixtures = [
  { id: 'bd-1', name: 'BD Hospital', facility_type: 'hospital', country_code: 'BD', lat: 23.7, lng: 90.4 },
  { id: 'th-1', name: 'Bangkok Hospital', facility_type: 'hospital', country_code: 'TH', lat: 13.7, lng: 100.5 },
  { id: 'th-2', name: 'Thong Lo Police', facility_type: 'police', country_code: 'TH', lat: 13.73, lng: 100.58 },
];

test('1. "all" filter returns all active-country facilities', () => {
  const result = filterFacilities(bdFacilities, 'all');
  assert.equal(result.length, 4);
  assert.deepEqual(result.map((f) => f.id), ['bd-h-1', 'bd-h-2', 'bd-p-1', 'bd-b-1']);
});

test('2. "hospital" filter returns only hospital facility_type', () => {
  const result = filterFacilities(bdFacilities, 'hospital');
  assert.equal(result.length, 2);
  assert.ok(result.every((f) => f.facility_type === 'hospital'));
  assert.deepEqual(result.map((f) => f.id), ['bd-h-1', 'bd-h-2']);
});

test('3. "police" filter returns only police facility_type', () => {
  const result = filterFacilities(bdFacilities, 'police');
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'bd-p-1');
  assert.equal(result[0].facility_type, 'police');
});

test('4. "towing" filter returns only towing facility_type', () => {
  const fixtureWithTowing = [
    ...bdFacilities,
    { id: 'bd-t-1', name: 'Dhaka Highway Towing', facility_type: 'towing', country_code: 'BD', lat: 23.8, lng: 90.4 },
  ];

  const result = filterFacilities(fixtureWithTowing, 'towing');
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'bd-t-1');
  assert.equal(result[0].facility_type, 'towing');
});

test('5. Filtering never crosses country boundaries', () => {
  // Pre-condition: active country facilities for TH
  const thOnly = mixedCountryFixtures.filter((f) => f.country_code === 'TH');
  assert.equal(thOnly.length, 2);

  const thHospitals = filterFacilities(thOnly, 'hospital');
  assert.equal(thHospitals.length, 1);
  assert.equal(thHospitals[0].country_code, 'TH');
  assert.equal(thHospitals[0].id, 'th-1');

  // Verify BD facility is never returned when filtering TH set
  assert.ok(!thHospitals.some((f) => f.country_code === 'BD'));
});

test('6. Empty category produces zero results', () => {
  // bdFacilities has no towing records
  const result = filterFacilities(bdFacilities, 'towing');
  assert.equal(result.length, 0, 'Towing category must be empty if no towing records exist');
});

test('7. Unknown/unsupported facility types are not incorrectly classified', () => {
  const weirdFixture = [
    { id: 'x-1', name: 'Unknown Place', facility_type: 'community_centre', country_code: 'BD' },
    { id: 'x-2', name: 'Unknown Shop', facility_type: 'pharmacy', country_code: 'BD' },
  ];

  assert.equal(filterFacilities(weirdFixture, 'hospital').length, 0);
  assert.equal(filterFacilities(weirdFixture, 'police').length, 0);
  assert.equal(filterFacilities(weirdFixture, 'towing').length, 0);

  // But 'all' preserves them without discarding
  assert.equal(filterFacilities(weirdFixture, 'all').length, 2);
});

test('8. Filtered results remain compatible with existing distance/ranking behavior', () => {
  const userLat = 23.8103;
  const userLng = 90.4125;

  const hospitalsOnly = filterFacilities(bdFacilities, 'hospital');
  assert.equal(hospitalsOnly.length, 2);

  const ranked = rankFacilities(hospitalsOnly, 'critical', userLat, userLng);
  assert.ok(Array.isArray(ranked));
  assert.equal(ranked.length, 2);
  assert.ok(ranked[0].totalScore >= ranked[1].totalScore);
  assert.ok(ranked[0].distance_km !== undefined);
});

test('10. getFilterCounts accurately aggregates canonical counts', () => {
  const counts = getFilterCounts(bdFacilities);
  assert.equal(counts.all, 4);
  assert.equal(counts.hospital, 2);
  assert.equal(counts.police, 1);
  assert.equal(counts.towing, 0);

  // Empty test
  const emptyCounts = getFilterCounts([]);
  assert.deepEqual(emptyCounts, { all: 0, hospital: 0, police: 0, towing: 0 });
});

test('9. India / no-data country behavior remains completely empty', () => {
  assert.equal(filterFacilities(inFacilities, 'all').length, 0);
  assert.equal(filterFacilities(inFacilities, 'hospital').length, 0);
  assert.equal(filterFacilities(inFacilities, 'police').length, 0);
  assert.equal(filterFacilities(inFacilities, 'towing').length, 0);
});
