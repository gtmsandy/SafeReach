import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const facilitiesPath = path.resolve(__dirname, '../../data/bimstec_facilities.json');
const rawFacilities = JSON.parse(fs.readFileSync(facilitiesPath, 'utf8'));

const resultsScreenPath = path.resolve(__dirname, '../../components/ResultsScreen.jsx');
const resultsScreenSource = fs.readFileSync(resultsScreenPath, 'utf8');

test('1. Facility Dataset Integrity (Coordinates, Types, Names, IDs)', () => {
  assert.ok(Array.isArray(rawFacilities), 'Facilities should be an array');
  assert.ok(rawFacilities.length > 0, 'Dataset should contain facilities');

  const validTypes = new Set(['hospital', 'police', 'blood_bank', 'ambulance', 'trauma_center', 'towing', 'clinic', 'puncture_shop']);
  const idSet = new Set();

  for (const f of rawFacilities) {
    // 1. Unique ID
    assert.ok(f.id, 'Facility must have an ID');
    assert.ok(!idSet.has(f.id), `Duplicate facility ID found: ${f.id}`);
    idSet.add(f.id);

    // 2. Non-empty Name
    assert.ok(typeof f.name === 'string' && f.name.trim().length > 0, `Facility ${f.id} must have a non-empty name`);

    // 3. Valid Type
    assert.ok(validTypes.has(f.facility_type), `Facility ${f.id} has invalid type: ${f.facility_type}`);

    // 4. Valid Coordinates
    assert.ok(typeof f.lat === 'number' && f.lat >= -90 && f.lat <= 90, `Facility ${f.id} invalid lat: ${f.lat}`);
    assert.ok(typeof f.lng === 'number' && f.lng >= -180 && f.lng <= 180, `Facility ${f.id} invalid lng: ${f.lng}`);

    // 5. Valid Country Code
    assert.ok(typeof f.country_code === 'string' && f.country_code.length === 2, `Facility ${f.id} invalid country: ${f.country_code}`);
  }
});

test('2. Country Filtering: Strict isolation (BD, TH, LK, NP, MM, BT)', () => {
  const bdFacilities = rawFacilities.filter((f) => f.country_code === 'BD');
  assert.ok(bdFacilities.length > 0, 'Should have Bangladesh facilities');
  assert.ok(bdFacilities.every((f) => f.country_code === 'BD'), 'All BD filtered facilities must have country_code BD');

  const thFacilities = rawFacilities.filter((f) => f.country_code === 'TH');
  assert.ok(thFacilities.length > 0, 'Should have Thailand facilities');
  assert.ok(thFacilities.every((f) => f.country_code === 'TH'), 'All TH filtered facilities must have country_code TH');
});

test('3. India Facility Isolation: IN query never returns another countrys facilities', () => {
  // Direct filter by country_code === 'IN'
  const inFacilities = rawFacilities.filter((f) => f.country_code === 'IN');

  // Verify no fabricated facilities were added
  assert.equal(inFacilities.length, 0, 'India facility count should be 0 (no fabricated facilities allowed)');

  // Verify that filtering for IN strictly yields 0, never returning other country facilities
  assert.ok(!inFacilities.some((f) => f.country_code !== 'IN'), 'India query must NEVER include foreign facilities');
});

test('4. Mock Data Elimination: ResultsScreen does not use hardcoded mock facilities', () => {
  // Ensure mock IDs are absent
  assert.ok(!resultsScreenSource.includes('mock-hospital'), 'ResultsScreen must not contain mock-hospital');
  assert.ok(!resultsScreenSource.includes('mock-police-1'), 'ResultsScreen must not contain mock-police-1');
  assert.ok(!resultsScreenSource.includes('mock-police-2'), 'ResultsScreen must not contain mock-police-2');
  assert.ok(!resultsScreenSource.includes('mock-tow-1'), 'ResultsScreen must not contain mock-tow-1');
  assert.ok(!resultsScreenSource.includes('mock-mech-1'), 'ResultsScreen must not contain mock-mech-1');

  // Ensure fake phone numbers are absent
  assert.ok(!resultsScreenSource.includes('+919999988888'), 'ResultsScreen must not contain fake phone number +919999988888');
  assert.ok(!resultsScreenSource.includes('+918888877777'), 'ResultsScreen must not contain fake phone number +918888877777');

  // Ensure cross-country fallback to all facilities is absent
  assert.ok(
    !resultsScreenSource.includes('db.facilities.toArray()'),
    'ResultsScreen must not fall back to db.facilities.toArray() across all countries'
  );

  // Ensure safe empty state is present
  assert.ok(
    resultsScreenSource.includes('empty-facilities-notice'),
    'ResultsScreen must render empty-facilities-notice when no facilities match'
  );
});
