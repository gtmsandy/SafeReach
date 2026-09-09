import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const homeScreenPath = path.resolve(__dirname, '../../components/HomeScreen.jsx');
const homeScreenSource = fs.readFileSync(homeScreenPath, 'utf8');

const i18nDir = path.resolve(__dirname, '../../i18n');
const en = JSON.parse(fs.readFileSync(path.join(i18nDir, 'en.json'), 'utf8'));
const bn = JSON.parse(fs.readFileSync(path.join(i18nDir, 'bn.json'), 'utf8'));
const ne = JSON.parse(fs.readFileSync(path.join(i18nDir, 'ne.json'), 'utf8'));
const th = JSON.parse(fs.readFileSync(path.join(i18nDir, 'th.json'), 'utf8'));

test('1. Unified Emergency label exists across all BIMSTEC translations', () => {
  assert.ok(en.unified_emergency, 'en.json must contain unified_emergency');
  assert.ok(bn.unified_emergency, 'bn.json must contain unified_emergency');
  assert.ok(ne.unified_emergency, 'ne.json must contain unified_emergency');
  assert.ok(th.unified_emergency, 'th.json must contain unified_emergency');

  assert.equal(en.unified_emergency, 'Unified');
});

test('2. HomeScreen uses centralized primary-contact logic and synchronization', () => {
  assert.ok(
    homeScreenSource.includes("import { getPrimaryContact, SOS_UPDATED_EVENT } from '../logic/emergencyContacts'"),
    'HomeScreen must import getPrimaryContact and SOS_UPDATED_EVENT from emergencyContacts.js'
  );
  assert.ok(
    homeScreenSource.includes('window.addEventListener(SOS_UPDATED_EVENT'),
    'HomeScreen must listen for SOS_UPDATED_EVENT'
  );
  assert.ok(
    homeScreenSource.includes('window.removeEventListener(SOS_UPDATED_EVENT'),
    'HomeScreen must properly remove SOS_UPDATED_EVENT listener on unmount'
  );
});

test('3. Emergency Numbers: Unified 112 is NOT labeled Hospital and has appropriate beacon', () => {
  assert.ok(homeScreenSource.includes('id="btn-call-unified"'), 'Unified call button must have id="btn-call-unified"');
  assert.ok(homeScreenSource.includes("label={t('unified_emergency')"), 'Unified call button must use unified_emergency label');
  assert.ok(!homeScreenSource.includes('id="btn-call-hospital"'), 'HomeScreen must NOT label 112 as btn-call-hospital');

  // Verify the quick call button row contains police, ambulance, and unified
  assert.ok(homeScreenSource.includes('id="btn-call-police"'));
  assert.ok(homeScreenSource.includes('id="btn-call-ambulance"'));
});

test('4. Hierarchy: Emergency Contact Ready card appears after Quick Access and before SOS', () => {
  const quickAccessIndex = homeScreenSource.indexOf('QUICK ACCESS');
  const contactReadyIndex = homeScreenSource.indexOf('id="card-emergency-contact-ready"');
  const sosIndex = homeScreenSource.indexOf('<SilentSOSButton');

  assert.ok(quickAccessIndex !== -1, 'Quick access section must exist');
  assert.ok(contactReadyIndex !== -1, 'card-emergency-contact-ready must exist');
  assert.ok(sosIndex !== -1, 'SilentSOSButton must exist');

  assert.ok(
    quickAccessIndex < contactReadyIndex,
    'Emergency Contact Ready card must appear AFTER Quick Access section'
  );
  assert.ok(
    contactReadyIndex < sosIndex,
    'Emergency Contact Ready card must appear BEFORE SilentSOSButton'
  );
});

test('5. Quick Access contains all 4 intended navigation targets', () => {
  assert.ok(/navigate\(\s*['"]\/map['"]\s*\)/.test(homeScreenSource), 'Must link to /map');
  assert.ok(/navigate\(\s*['"]\/countries['"]\s*\)/.test(homeScreenSource), 'Must link to /countries');
  assert.ok(/navigate\(\s*['"]\/firstaid\/minor_injury['"]\s*\)/.test(homeScreenSource), 'Must link to /firstaid/minor_injury');
  assert.ok(/navigate\(\s*['"]\/emergency-contacts['"]\s*\)/.test(homeScreenSource), 'Must link to /emergency-contacts');
});
