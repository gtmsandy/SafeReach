import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Global mocks for Node environment
let isOnline = true;
try {
  Object.defineProperty(globalThis.navigator, 'onLine', {
    get: () => isOnline,
    configurable: true,
  });
} catch {
  globalThis.navigator = { onLine: true };
}

let dispatchedEvents = [];
globalThis.window = {
  dispatchEvent: (event) => {
    dispatchedEvents.push(event);
    return true;
  },
  addEventListener: () => {},
  removeEventListener: () => {},
};
globalThis.CustomEvent = class CustomEvent {
  constructor(type, options = {}) {
    this.type = type;
    this.detail = options.detail || {};
  }
};

import {
  db,
  saveIncident,
  updateIncidentSyncStatus,
  getPendingIncidents,
  getIncidents,
  generateUUID,
} from '../offlineDB.js';

import {
  syncTriageIncident,
  syncPendingIncidents,
  TRIAGE_SYNC_EVENT,
} from '../triageSync.js';

// Setup in-memory table mock for Dexie in Node environment
let incidentStore = [];
let nextIncidentId = 1;

function resetVault() {
  incidentStore = [];
  nextIncidentId = 1;
  dispatchedEvents = [];
  isOnline = true;

  db.incidents = {
    add: async (item) => {
      const id = nextIncidentId++;
      const record = { ...item, id };
      incidentStore.push(record);
      return id;
    },
    update: async (id, changes) => {
      const inc = incidentStore.find((x) => Number(x.id) === Number(id));
      if (!inc) return 0;
      Object.assign(inc, changes);
      return 1;
    },
    get: async (id) => incidentStore.find((x) => Number(x.id) === Number(id)) || null,
    toArray: async () => [...incidentStore],
    orderBy: () => ({
      reverse: () => ({
        toArray: async () => [...incidentStore].reverse(),
      }),
    }),
    clear: async () => {
      incidentStore = [];
    },
  };
}

test('1. saveIncident assigns session_id and default pending sync_status', async () => {
  resetVault();

  const incident = await saveIncident({
    country_code: 'BD',
    severity: 'critical',
    score: 6,
    summary: 'Critical Trauma Assessment',
  });

  assert.ok(incident.id, 'Incident must receive auto-id');
  assert.ok(incident.session_id, 'Incident must receive stable session_id UUID');
  assert.equal(incident.sync_status, 'pending', 'Initial sync_status must be pending');
  assert.equal(incident.synced_at, null, 'synced_at must be null initially');
  assert.equal(incident.backend_session_id, null, 'backend_session_id must be null initially');
});

test('2. Triage completion succeeds with backend available (valid response -> synced)', async () => {
  resetVault();

  const incident = await saveIncident({
    country_code: 'BD',
    severity: 'critical',
    score: 6,
    summary: 'Critical Trauma Assessment',
  });

  const mockSessionId = generateUUID();
  globalThis.fetch = async (url, options) => {
    assert.ok(url.includes('/api/v1/triage/sessions'));
    assert.equal(options.method, 'POST');
    const body = JSON.parse(options.body);
    assert.equal(body.severity, 'critical');
    assert.equal(body.country_code, 'BD');

    return {
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        session_id: mockSessionId,
        status: 'created',
      }),
    };
  };

  const syncResult = await syncTriageIncident(incident);
  assert.equal(syncResult.success, true);
  assert.equal(syncResult.status, 'created');
  assert.equal(syncResult.sessionId, mockSessionId);

  // Verify vault updated truthfully
  const stored = incidentStore.find((x) => x.id === incident.id);
  assert.equal(stored.sync_status, 'synced');
  assert.ok(stored.synced_at, 'Must have synced_at timestamp');
  assert.equal(stored.backend_session_id, mockSessionId);
  assert.equal(stored.sync_error, null);
});

test('3. HTTP 200 with malformed JSON does NOT mark incident synced', async () => {
  resetVault();

  const incident = await saveIncident({
    country_code: 'TH',
    severity: 'serious',
    score: 4,
  });

  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => {
      throw new SyntaxError('Unexpected token < in JSON at position 0');
    },
  });

  const syncResult = await syncTriageIncident(incident);
  assert.equal(syncResult.success, false);
  assert.equal(syncResult.status, 'validation_error');
  assert.ok(syncResult.error.includes('malformed JSON'));

  const stored = incidentStore.find((x) => x.id === incident.id);
  assert.equal(stored.sync_status, 'failed');
  assert.notEqual(stored.sync_status, 'synced', 'Must NEVER be marked synced on malformed JSON');
  assert.equal(stored.synced_at, null);
  assert.ok(stored.sync_error);
});

test('4. HTTP 200 with missing session_id does NOT mark incident synced', async () => {
  resetVault();

  const incident = await saveIncident({
    country_code: 'NP',
    severity: 'critical',
    score: 7,
  });

  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      success: true,
      // session_id is intentionally omitted
      status: 'created',
    }),
  });

  const syncResult = await syncTriageIncident(incident);
  assert.equal(syncResult.success, false);
  assert.equal(syncResult.status, 'validation_error');
  assert.ok(syncResult.error.includes('session_id'));

  const stored = incidentStore.find((x) => x.id === incident.id);
  assert.equal(stored.sync_status, 'failed');
  assert.notEqual(stored.sync_status, 'synced');
  assert.equal(stored.synced_at, null);
});

test('5. HTTP 200 with success !== true does NOT mark incident synced', async () => {
  resetVault();

  const incident = await saveIncident({
    country_code: 'LK',
    severity: 'stable',
    score: 2,
  });

  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      success: false,
      session_id: generateUUID(),
      status: 'created',
      detail: 'Internal rejection',
    }),
  });

  const syncResult = await syncTriageIncident(incident);
  assert.equal(syncResult.success, false);
  assert.equal(syncResult.status, 'validation_error');
  assert.ok(syncResult.error.includes('success'));

  const stored = incidentStore.find((x) => x.id === incident.id);
  assert.equal(stored.sync_status, 'failed');
  assert.notEqual(stored.sync_status, 'synced');
  assert.equal(stored.synced_at, null);
});

test('6. HTTP 200 with unexpected status does NOT mark incident synced', async () => {
  resetVault();

  const incident = await saveIncident({
    country_code: 'MM',
    severity: 'serious',
    score: 5,
  });

  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      success: true,
      session_id: generateUUID(),
      status: 'unknown_unsupported_status',
    }),
  });

  const syncResult = await syncTriageIncident(incident);
  assert.equal(syncResult.success, false);
  assert.equal(syncResult.status, 'validation_error');
  assert.ok(syncResult.error.includes('unexpected status'));

  const stored = incidentStore.find((x) => x.id === incident.id);
  assert.equal(stored.sync_status, 'failed');
  assert.notEqual(stored.sync_status, 'synced');
  assert.equal(stored.synced_at, null);
});

test('7. Triage completion succeeds when backend is unavailable (offline mode)', async () => {
  resetVault();
  isOnline = false;

  let fetchCalled = false;
  globalThis.fetch = async () => {
    fetchCalled = true;
    throw new Error('Should not call fetch when offline');
  };

  const incident = await saveIncident({
    country_code: 'NP',
    severity: 'serious',
    score: 4,
    summary: 'Serious Trauma Assessment',
    was_offline: true,
  });

  const syncResult = await syncTriageIncident(incident);
  assert.equal(fetchCalled, false, 'Fetch must never be called while offline');
  assert.equal(syncResult.success, false);
  assert.equal(syncResult.status, 'offline');

  // Verify vault preserves record with pending sync
  const stored = incidentStore.find((x) => x.id === incident.id);
  assert.ok(stored, 'Incident must remain stored in local vault');
  assert.equal(stored.sync_status, 'pending');
  assert.equal(stored.severity, 'serious');
});

test('8. Network failure marks incident pending and does NOT crash or lose data', async () => {
  resetVault();
  isOnline = true;

  globalThis.fetch = async () => {
    throw new Error('Failed to fetch (net::ERR_CONNECTION_REFUSED)');
  };

  const incident = await saveIncident({
    country_code: 'TH',
    severity: 'stable',
    score: 1,
    summary: 'Minor Injury Assessment',
  });

  const syncResult = await syncTriageIncident(incident);
  assert.equal(syncResult.success, false);
  assert.equal(syncResult.status, 'network_error');
  assert.ok(syncResult.error.includes('CONNECTION_REFUSED'));

  // Record preserved in vault
  const stored = incidentStore.find((x) => x.id === incident.id);
  assert.ok(stored, 'Incident must remain intact in local vault');
  assert.equal(stored.sync_status, 'pending');
  assert.ok(stored.sync_error);
});

test('9. Failed server response (HTTP 500) is marked failed and not falsely marked synced', async () => {
  resetVault();
  isOnline = true;

  globalThis.fetch = async () => ({
    ok: false,
    status: 500,
    statusText: 'Internal Server Error',
    json: async () => ({ detail: 'Database error' }),
  });

  const incident = await saveIncident({
    country_code: 'BD',
    severity: 'critical',
    score: 8,
    summary: 'Critical Trauma Assessment',
  });

  const syncResult = await syncTriageIncident(incident);
  assert.equal(syncResult.success, false);
  assert.equal(syncResult.status, 'failed');

  const stored = incidentStore.find((x) => x.id === incident.id);
  assert.equal(stored.sync_status, 'failed', 'Must truthfully record failed status');
  assert.notEqual(stored.sync_status, 'synced', 'Must NEVER falsely mark synced on error');
  assert.equal(stored.synced_at, null);
});

test('10. Repeated synchronization uses stable session_id (idempotency client payload)', async () => {
  resetVault();
  isOnline = true;

  const incident = await saveIncident({
    country_code: 'BD',
    severity: 'critical',
    score: 6,
  });

  const capturedIds = [];
  globalThis.fetch = async (url, options) => {
    const body = JSON.parse(options.body);
    capturedIds.push(body.id);
    return {
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        session_id: body.id,
        status: capturedIds.length === 1 ? 'created' : 'already_synced',
      }),
    };
  };

  // Sync attempt 1
  const res1 = await syncTriageIncident(incident);
  assert.equal(res1.status, 'created');

  // Sync attempt 2 (retry)
  const res2 = await syncTriageIncident(incident);
  assert.equal(res2.status, 'already_synced');

  // Both attempts sent the exact same stable session_id
  assert.equal(capturedIds.length, 2);
  assert.equal(capturedIds[0], capturedIds[1]);
  assert.equal(capturedIds[0], incident.session_id);
});

test('11. Country code: transmits actual country code and never silently substitutes BD', async () => {
  resetVault();
  isOnline = true;

  // 1. Thailand incident -> must transmit "TH", not "BD"
  let sentCountry = null;
  globalThis.fetch = async (url, options) => {
    const body = JSON.parse(options.body);
    sentCountry = body.country_code;
    return {
      ok: true,
      status: 200,
      json: async () => ({ success: true, session_id: body.id, status: 'created' }),
    };
  };

  const thaiIncident = await saveIncident({ country_code: 'TH', severity: 'serious' });
  await syncTriageIncident(thaiIncident);
  assert.equal(sentCountry, 'TH', 'Actual country_code TH must be transmitted');

  // 2. Nepal incident -> must transmit "NP"
  const nepalIncident = await saveIncident({ country_code: 'np', severity: 'stable' });
  await syncTriageIncident(nepalIncident);
  assert.equal(sentCountry, 'NP', 'Actual country_code NP must be transmitted in uppercase');

  // 3. Missing country incident -> must transmit null, NEVER silently default to "BD"
  const unknownIncident = await saveIncident({ severity: 'critical' });
  await syncTriageIncident(unknownIncident);
  assert.equal(sentCountry, null, 'Missing country_code must be null, NEVER silently default to BD');
});

test('12. syncPendingIncidents synchronizes only pending and failed incidents', async () => {
  resetVault();
  isOnline = true;

  const inc1 = await saveIncident({ severity: 'critical', sync_status: 'pending' });
  const inc2 = await saveIncident({ severity: 'stable', sync_status: 'synced', synced_at: new Date().toISOString() });
  const inc3 = await saveIncident({ severity: 'serious', sync_status: 'failed' });

  const pendingBefore = await getPendingIncidents();
  assert.equal(pendingBefore.length, 2, 'Should only return pending and failed');
  assert.ok(pendingBefore.some((x) => x.id === inc1.id));
  assert.ok(pendingBefore.some((x) => x.id === inc3.id));
  assert.ok(!pendingBefore.some((x) => x.id === inc2.id));

  // Sync mock
  globalThis.fetch = async (url, options) => {
    const body = JSON.parse(options.body);
    return {
      ok: true,
      status: 200,
      json: async () => ({ success: true, session_id: body.id, status: 'created' }),
    };
  };

  const batchResult = await syncPendingIncidents();
  assert.equal(batchResult.total, 2);
  assert.equal(batchResult.synced, 2);
  assert.equal(batchResult.failed, 0);

  const pendingAfter = await getPendingIncidents();
  assert.equal(pendingAfter.length, 0, 'All incidents should now be synced');
});

test('13. TriageFlow source connects background sync without blocking navigation', () => {
  const flowPath = path.resolve(__dirname, '../../components/TriageFlow.jsx');
  const flowSource = fs.readFileSync(flowPath, 'utf8');

  assert.ok(
    flowSource.includes("import { syncTriageIncident } from '../logic/triageSync'"),
    'TriageFlow must import syncTriageIncident'
  );
  assert.ok(
    flowSource.includes('syncTriageIncident(saved)'),
    'TriageFlow must invoke syncTriageIncident with the saved incident'
  );
  assert.ok(
    flowSource.includes("navigate('/results')"),
    'TriageFlow must navigate to results'
  );
  assert.ok(
    !flowSource.includes('|| \'BD\''),
    'TriageFlow must NOT hardcode fallback to BD'
  );
});

test('14. Translation consistency: Unit 8 sync keys present in all BIMSTEC languages', () => {
  const i18nDir = path.resolve(__dirname, '../../i18n');
  const en = JSON.parse(fs.readFileSync(path.join(i18nDir, 'en.json'), 'utf8'));
  const bn = JSON.parse(fs.readFileSync(path.join(i18nDir, 'bn.json'), 'utf8'));
  const ne = JSON.parse(fs.readFileSync(path.join(i18nDir, 'ne.json'), 'utf8'));
  const th = JSON.parse(fs.readFileSync(path.join(i18nDir, 'th.json'), 'utf8'));

  const requiredKeys = [
    'synced',
    'pending_sync',
    'sync_failed',
    'sync_now',
    'retry',
  ];

  for (const key of requiredKeys) {
    assert.ok(en[key], `en.json must contain ${key}`);
    assert.ok(bn[key], `bn.json must contain ${key}`);
    assert.ok(ne[key], `ne.json must contain ${key}`);
    assert.ok(th[key], `th.json must contain ${key}`);
  }
});
