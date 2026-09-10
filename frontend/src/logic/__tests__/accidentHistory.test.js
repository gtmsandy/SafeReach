import test from 'node:test';
import assert from 'node:assert/strict';
import {
  db,
  saveIncident,
  getIncidents,
  getIncidentById,
  deleteIncident,
  saveTriageSession,
} from '../offlineDB.js';

// Setup in-memory table mock for Dexie in Node environment
let incidentStore = [];
let legacyStore = [];
let nextIncidentId = 1;

function resetStore() {
  incidentStore = [];
  legacyStore = [];
  nextIncidentId = 1;

  db.incidents = {
    add: async (item) => {
      const id = nextIncidentId++;
      const record = { ...item, id };
      incidentStore.push(record);
      return id;
    },
    orderBy: (field) => ({
      reverse: () => ({
        toArray: async () => [...incidentStore].reverse(),
      }),
    }),
    get: async (id) => incidentStore.find((x) => Number(x.id) === Number(id)) || null,
    delete: async (id) => {
      const idx = incidentStore.findIndex((x) => Number(x.id) === Number(id));
      if (idx !== -1) incidentStore.splice(idx, 1);
    },
    clear: async () => {
      incidentStore = [];
    },
  };

  db.triage_sessions = {
    add: async (item) => {
      const id = nextIncidentId++;
      const record = { ...item, id };
      legacyStore.push(record);
      return id;
    },
    orderBy: (field) => ({
      reverse: () => ({
        toArray: async () => [...legacyStore].reverse(),
      }),
    }),
    get: async (id) => legacyStore.find((x) => Number(x.id) === Number(id)) || null,
    delete: async (id) => {
      const idx = legacyStore.findIndex((x) => Number(x.id) === Number(id));
      if (idx !== -1) legacyStore.splice(idx, 1);
    },
    clear: async () => {
      legacyStore = [];
    },
  };
}

test('1. Initial empty history state', async () => {
  resetStore();
  const list = await getIncidents();
  assert.deepEqual(list, [], 'Incident vault must be empty initially');
});

test('2. Save a completed triage incident into local vault', async () => {
  resetStore();

  const incident = {
    country_code: 'BD',
    severity: 'critical',
    score: 6,
    summary: 'Critical Trauma Assessment · NO_MOVE',
    first_aid_id: 'critical_trauma',
    flags: ['NO_MOVE'],
    responses: [
      { q_id: 'q1', option_id: 'unconscious' },
      { q_id: 'q2', option_id: 'heavy' },
      { q_id: 'q3', option_id: 'yes' },
    ],
    was_offline: true,
    location: null, // Location unavailable; never fabricated
  };

  const saved = await saveIncident(incident);
  assert.ok(saved.id, 'Saved incident must have an ID');
  assert.equal(saved.severity, 'critical');
  assert.equal(saved.score, 6);
  assert.equal(saved.summary, 'Critical Trauma Assessment · NO_MOVE');
  assert.equal(saved.first_aid_id, 'critical_trauma');
  assert.deepEqual(saved.flags, ['NO_MOVE']);
  assert.equal(saved.location, null, 'Location must remain null when unavailable');
  assert.ok(saved.created_at, 'Must assign ISO created_at timestamp');

  const all = await getIncidents();
  assert.equal(all.length, 1);
  assert.equal(all[0].id, saved.id);
});

test('3. Severity validation failure when severity is missing', async () => {
  resetStore();
  await assert.rejects(
    async () => {
      await saveIncident({ score: 4 });
    },
    /severity is required/i,
    'Should throw error if severity is missing'
  );
});

test('4. Newest-first ordering when multiple incidents exist', async () => {
  resetStore();

  const inc1 = await saveIncident({ severity: 'stable', summary: 'Incident 1' });
  const inc2 = await saveIncident({ severity: 'serious', summary: 'Incident 2' });
  const inc3 = await saveIncident({ severity: 'critical', summary: 'Incident 3' });

  const list = await getIncidents();
  assert.equal(list.length, 3);
  assert.equal(list[0].id, inc3.id, 'Most recent incident (3) must be first');
  assert.equal(list[1].id, inc2.id, 'Middle incident (2) must be second');
  assert.equal(list[2].id, inc1.id, 'Oldest incident (1) must be last');
});

test('5. Delete individual incident and preserve other incidents', async () => {
  resetStore();

  const inc1 = await saveIncident({ severity: 'stable', summary: 'Incident 1' });
  const inc2 = await saveIncident({ severity: 'serious', summary: 'Incident 2' });
  const inc3 = await saveIncident({ severity: 'critical', summary: 'Incident 3' });

  // Delete middle incident
  await deleteIncident(inc2.id);

  const remaining = await getIncidents();
  assert.equal(remaining.length, 2, 'Remaining count must be 2');
  assert.equal(remaining[0].id, inc3.id);
  assert.equal(remaining[1].id, inc1.id);
  assert.equal(await getIncidentById(inc2.id), null, 'Deleted incident should not exist');
});

test('6. Triage session save delegate maintains backwards-compatibility', async () => {
  resetStore();

  const legacySession = await saveTriageSession({
    severity: 'critical',
    country_code: 'NP',
    score: 7,
  });

  assert.ok(legacySession.id);
  assert.equal(legacySession.severity, 'critical');

  const list = await getIncidents();
  assert.equal(list.length, 1);
  assert.equal(list[0].id, legacySession.id);
});

test('7. Duplicate-save prevention logic', async () => {
  resetStore();

  // Simulate TriageFlow's submitting guard
  let submitting = false;
  let saveCount = 0;

  async function triggerSave(payload) {
    if (submitting) return null;
    submitting = true;
    saveCount++;
    return saveIncident(payload);
  }

  const payload = { severity: 'serious', summary: 'Triage' };

  // First call saves
  const first = await triggerSave(payload);
  assert.ok(first);

  // Rapid subsequent calls blocked by submitting guard
  const second = await triggerSave(payload);
  const third = await triggerSave(payload);

  assert.equal(second, null, 'Second call should be blocked');
  assert.equal(third, null, 'Third call should be blocked');
  assert.equal(saveCount, 1, 'Only one save must execute');

  const list = await getIncidents();
  assert.equal(list.length, 1);
});

test('8. Dexie schema version 2 migration and store preservation', () => {
  assert.ok(db.verno >= 2, `Dexie version must be >= 2 for migration, current verno is ${db.verno}`);
  const tableNames = db.tables.map((t) => t.name);
  assert.ok(tableNames.includes('facilities'), 'Must preserve facilities store');
  assert.ok(tableNames.includes('emergency_numbers'), 'Must preserve emergency_numbers store');
  assert.ok(tableNames.includes('first_aid_protocols'), 'Must preserve first_aid_protocols store');
  assert.ok(tableNames.includes('triage_sessions'), 'Must preserve triage_sessions store');
  assert.ok(tableNames.includes('incidents'), 'Must register new incidents store in version 2');
  assert.ok(tableNames.includes('sync_meta'), 'Must preserve sync_meta store');
});
