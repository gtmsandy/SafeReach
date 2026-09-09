import test from 'node:test';
import assert from 'node:assert/strict';

// Mock localStorage and window for Node environment
const store = {};
let dispatchedEvents = [];

globalThis.localStorage = {
  getItem: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
  setItem: (k, v) => {
    store[k] = String(v);
  },
  removeItem: (k) => {
    delete store[k];
  },
  clear: () => {
    Object.keys(store).forEach((k) => delete store[k]);
  },
};

globalThis.window = {
  dispatchEvent: (event) => {
    dispatchedEvents.push(event.type);
    return true;
  },
};

globalThis.CustomEvent = class CustomEvent {
  constructor(type) {
    this.type = type;
  }
};

import {
  getContacts,
  getPrimaryContact,
  setPrimaryContact,
  addContact,
  updateContact,
  deleteContact,
  normalizePhoneNumber,
  SOS_UPDATED_EVENT,
} from '../emergencyContacts.js';

test('1. Initial empty contact state', () => {
  globalThis.localStorage.clear();
  dispatchedEvents = [];

  assert.deepEqual(getContacts(), [], 'Initial contacts should be empty array');
  assert.equal(getPrimaryContact(), null, 'Initial primary contact should be null');
});

test('2 & 3. Add contact and retrieve contacts', () => {
  globalThis.localStorage.clear();
  dispatchedEvents = [];

  const contact = addContact({
    name: 'Alice Smith',
    phone: '+91 98765 43210',
    relationship: 'Sister',
  });

  assert.ok(contact.id, 'Should assign an ID');
  assert.equal(contact.name, 'Alice Smith');
  assert.equal(contact.phone, '+919876543210', 'Should normalize phone digits and leading plus');
  assert.equal(contact.relationship, 'Sister');

  const all = getContacts();
  assert.equal(all.length, 1);
  assert.equal(all[0].name, 'Alice Smith');
});

test('4 & 5. Retrieve primary contact and fallback behavior', () => {
  globalThis.localStorage.clear();
  dispatchedEvents = [];

  // First contact added automatically becomes primary
  const c1 = addContact({ name: 'Bob', phone: '9876543211', relationship: 'Friend' });
  const primary = getPrimaryContact();
  assert.ok(primary);
  assert.equal(primary.id, c1.id);
  assert.equal(primary.phone, '9876543211');

  // Add second contact - primary remains the first
  const c2 = addContact({ name: 'Charlie', phone: '9876543212', relationship: 'Colleague' });
  assert.equal(getPrimaryContact().id, c1.id);

  // Fallback: If sos_contact pointer is cleared, falls back to first contact
  globalThis.localStorage.removeItem('sos_contact');
  const fallback = getPrimaryContact();
  assert.ok(fallback);
  assert.equal(fallback.id, c1.id);
});

test('6. Promote/set primary contact', () => {
  globalThis.localStorage.clear();
  dispatchedEvents = [];

  const c1 = addContact({ name: 'David', phone: '9876543213' });
  const c2 = addContact({ name: 'Emma', phone: '9876543214' });

  assert.equal(getPrimaryContact().id, c1.id);

  // Explicitly promote c2
  setPrimaryContact(c2.id);
  assert.equal(getPrimaryContact().id, c2.id);
  assert.equal(getPrimaryContact().name, 'Emma');

  // Verify contacts array flags
  const contacts = getContacts();
  assert.equal(contacts.find((c) => c.id === c2.id).is_primary, true);
  assert.equal(contacts.find((c) => c.id === c1.id).is_primary, false);
});

test('7 & 8. Delete contact and deleting primary chooses safe fallback or returns no primary', () => {
  globalThis.localStorage.clear();
  dispatchedEvents = [];

  const c1 = addContact({ name: 'Frank', phone: '9876543215' });
  const c2 = addContact({ name: 'Grace', phone: '9876543216' });

  // Currently c1 is primary. Delete c1.
  deleteContact(c1.id);
  assert.equal(getContacts().length, 1);

  // c2 should be promoted to primary
  const primaryAfterDelete = getPrimaryContact();
  assert.ok(primaryAfterDelete);
  assert.equal(primaryAfterDelete.id, c2.id);
  assert.equal(primaryAfterDelete.name, 'Grace');

  // Delete remaining contact -> primary becomes null
  deleteContact(c2.id);
  assert.equal(getContacts().length, 0);
  assert.equal(getPrimaryContact(), null);
});

test('9. Malformed/unsafe telephone input is rejected or safely normalized', () => {
  // Valid international formats
  assert.equal(normalizePhoneNumber('+91 98765-43210').valid, true);
  assert.equal(normalizePhoneNumber('+91 98765-43210').normalized, '+919876543210');
  assert.equal(normalizePhoneNumber('(044) 2530-5000').valid, true);
  assert.equal(normalizePhoneNumber('(044) 2530-5000').normalized, '04425305000');
  assert.equal(normalizePhoneNumber('112').valid, true);
  assert.equal(normalizePhoneNumber('112').normalized, '112');

  // Reject malformed/dangerous inputs
  assert.equal(normalizePhoneNumber('').valid, false);
  assert.equal(normalizePhoneNumber('   ').valid, false);
  assert.equal(normalizePhoneNumber('12').valid, false, 'Less than 3 digits rejected');
  assert.equal(normalizePhoneNumber('1234567890123456').valid, false, 'Over 15 digits rejected');
  assert.equal(normalizePhoneNumber('abc12345').valid, false, 'Letters rejected');
  assert.equal(normalizePhoneNumber('javascript:alert(1)').valid, false, 'URI injection rejected');
  assert.equal(normalizePhoneNumber('<script>').valid, false, 'HTML injection rejected');

  // Validation in addContact
  assert.throws(() => {
    addContact({ name: '', phone: '9876543210' });
  }, /required/);

  assert.throws(() => {
    addContact({ name: 'Test', phone: 'invalid-phone' });
  }, /Invalid|Phone/);
});

test('10. Contact-change event is dispatched on mutations', () => {
  globalThis.localStorage.clear();
  dispatchedEvents = [];

  // 1. Add contact
  const c1 = addContact({ name: 'Hannah', phone: '9876543217' });
  assert.ok(dispatchedEvents.includes(SOS_UPDATED_EVENT), 'Should dispatch event on add');
  dispatchedEvents = [];

  // 2. Add second contact
  const c2 = addContact({ name: 'Ian', phone: '9876543218' });
  assert.ok(dispatchedEvents.includes(SOS_UPDATED_EVENT));
  dispatchedEvents = [];

  // 3. Promote primary
  setPrimaryContact(c2.id);
  assert.ok(dispatchedEvents.includes(SOS_UPDATED_EVENT), 'Should dispatch event on setPrimary');
  dispatchedEvents = [];

  // 4. Update contact
  updateContact(c1.id, { name: 'Hannah Montana' });
  assert.ok(dispatchedEvents.includes(SOS_UPDATED_EVENT), 'Should dispatch event on update');
  dispatchedEvents = [];

  // 5. Delete contact
  deleteContact(c1.id);
  assert.ok(dispatchedEvents.includes(SOS_UPDATED_EVENT), 'Should dispatch event on delete');
});
