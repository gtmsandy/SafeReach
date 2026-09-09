/**
 * SafeReach Emergency Contacts Logic Module
 * Single source of truth for emergency contact persistence, validation,
 * primary contact selection, and cross-component synchronization.
 */

export const CONTACTS_STORAGE_KEY = 'emergency_contacts';
export const SOS_PRIMARY_STORAGE_KEY = 'sos_contact';
export const SOS_UPDATED_EVENT = 'sos_contact_updated';

/**
 * Dispatches the synchronization event to all listening components.
 */
export function notifyContactsUpdated() {
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent(SOS_UPDATED_EVENT));
  }
}

/**
 * Validates and normalizes phone numbers for safe tel: and sms: URI usage.
 * Preserves optional leading '+' for international format followed by digits.
 * Rejects numbers with fewer than 3 digits or invalid characters.
 *
 * @param {string} phone
 * @returns {{ valid: boolean, normalized: string, error?: string }}
 */
export function normalizePhoneNumber(phone) {
  if (!phone || typeof phone !== 'string') {
    return { valid: false, normalized: '', error: 'Phone number is required' };
  }

  const trimmed = phone.trim();
  // Check if string contains any illegal characters (only digits, +, -, space, parentheses allowed)
  if (/[^\d+\-\s().]/g.test(trimmed)) {
    return { valid: false, normalized: '', error: 'Phone number contains invalid characters' };
  }

  const hasLeadingPlus = trimmed.startsWith('+');
  const digitsOnly = trimmed.replace(/\D/g, '');

  if (digitsOnly.length < 3 || digitsOnly.length > 15) {
    return { valid: false, normalized: '', error: 'Phone number must contain between 3 and 15 digits' };
  }

  const normalized = hasLeadingPlus ? `+${digitsOnly}` : digitsOnly;
  return { valid: true, normalized };
}

/**
 * Retrieves all stored emergency contacts.
 * @returns {Array<Object>}
 */
export function getContacts() {
  try {
    const raw = localStorage.getItem(CONTACTS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error('[SafeReach] Failed to read emergency contacts from storage:', err);
    return [];
  }
}

/**
 * Saves contact list to localStorage.
 * Internal helper.
 */
function persistContacts(contacts) {
  try {
    localStorage.setItem(CONTACTS_STORAGE_KEY, JSON.stringify(contacts));
  } catch (err) {
    console.error('[SafeReach] Failed to save emergency contacts to storage:', err);
  }
}

/**
 * Retrieves the currently designated primary emergency contact.
 * Fallback priority:
 * 1. Explicit contact matching ID saved in `sos_contact`.
 * 2. Contact marked `is_primary: true` in `emergency_contacts`.
 * 3. First available contact in `emergency_contacts`.
 * 4. Fallback object in `sos_contact` if it has a valid phone.
 * 5. null.
 *
 * @returns {Object|null}
 */
export function getPrimaryContact() {
  const contacts = getContacts();

  // 1. Try reading `sos_contact` primary pointer
  try {
    const rawSOS = localStorage.getItem(SOS_PRIMARY_STORAGE_KEY);
    if (rawSOS) {
      const parsedSOS = JSON.parse(rawSOS);
      if (parsedSOS && parsedSOS.id) {
        const found = contacts.find((c) => String(c.id) === String(parsedSOS.id));
        if (found && found.phone) return found;
      }
      if (parsedSOS && parsedSOS.phone) {
        // Standalone SOS contact without ID in main list
        const check = normalizePhoneNumber(parsedSOS.phone);
        if (check.valid) {
          return {
            id: parsedSOS.id || 'primary-standalone',
            name: parsedSOS.name || 'Emergency Contact',
            phone: check.normalized,
            relationship: parsedSOS.relationship || 'Emergency Contact',
          };
        }
      }
    }
  } catch {}

  // 2. Check is_primary in contacts list
  const primaryInList = contacts.find((c) => c.is_primary);
  if (primaryInList && primaryInList.phone) {
    return primaryInList;
  }

  // 3. Fallback to first contact in list
  if (contacts.length > 0 && contacts[0].phone) {
    return contacts[0];
  }

  return null;
}

/**
 * Sets or promotes a contact to primary emergency contact status.
 *
 * @param {Object|string|number} contactOrId
 * @returns {boolean}
 */
export function setPrimaryContact(contactOrId) {
  const contacts = getContacts();
  const id = typeof contactOrId === 'object' && contactOrId !== null ? contactOrId.id : contactOrId;

  const target = contacts.find((c) => String(c.id) === String(id));
  if (!target) {
    // If an object with phone was passed directly (e.g. from standalone setup)
    if (typeof contactOrId === 'object' && contactOrId !== null && contactOrId.phone) {
      const phoneCheck = normalizePhoneNumber(contactOrId.phone);
      if (phoneCheck.valid) {
        const standalone = {
          id: String(contactOrId.id || `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`),
          name: (contactOrId.name || '').trim() || 'Emergency Contact',
          phone: phoneCheck.normalized,
          relationship: (contactOrId.relationship || '').trim() || 'Emergency Contact',
        };
        try {
          localStorage.setItem(SOS_PRIMARY_STORAGE_KEY, JSON.stringify(standalone));
          notifyContactsUpdated();
          return true;
        } catch {}
      }
    }
    return false;
  }

  // Update primary flags on all contacts
  const updated = contacts.map((c) => ({
    ...c,
    is_primary: String(c.id) === String(id),
  }));
  persistContacts(updated);

  // Sync to sos_contact
  try {
    const sosPayload = {
      id: target.id,
      name: target.name,
      phone: target.phone,
      relationship: target.relationship,
    };
    localStorage.setItem(SOS_PRIMARY_STORAGE_KEY, JSON.stringify(sosPayload));
  } catch (err) {
    console.error('[SafeReach] Failed to sync primary SOS contact:', err);
  }

  notifyContactsUpdated();
  return true;
}

/**
 * Adds a new emergency contact.
 * Validates inputs and automatically sets as primary if first contact.
 *
 * @param {{ name: string, phone: string, relationship?: string }} param0
 * @returns {Object} Newly created contact
 */
export function addContact({ name, phone, relationship }) {
  const trimmedName = (name || '').trim();
  if (!trimmedName) {
    throw new Error('Contact name is required');
  }

  const phoneCheck = normalizePhoneNumber(phone);
  if (!phoneCheck.valid) {
    throw new Error(phoneCheck.error || 'Invalid phone number');
  }

  const contacts = getContacts();
  const isFirst = contacts.length === 0;

  const newContact = {
    id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    name: trimmedName,
    phone: phoneCheck.normalized,
    relationship: (relationship || '').trim() || 'Emergency Contact',
    is_primary: isFirst,
    created_at: new Date().toISOString(),
  };

  const updated = [...contacts, newContact];
  persistContacts(updated);

  if (isFirst || !getPrimaryContact()) {
    try {
      localStorage.setItem(
        SOS_PRIMARY_STORAGE_KEY,
        JSON.stringify({
          id: newContact.id,
          name: newContact.name,
          phone: newContact.phone,
          relationship: newContact.relationship,
        })
      );
    } catch {}
  }

  notifyContactsUpdated();
  return newContact;
}

/**
 * Updates an existing emergency contact.
 *
 * @param {string|number} id
 * @param {{ name?: string, phone?: string, relationship?: string }} updates
 * @returns {Object} Updated contact
 */
export function updateContact(id, updates) {
  const contacts = getContacts();
  const targetIndex = contacts.findIndex((c) => String(c.id) === String(id));
  if (targetIndex === -1) {
    throw new Error('Contact not found');
  }

  const target = contacts[targetIndex];
  let updatedPhone = target.phone;

  if (updates.phone !== undefined) {
    const phoneCheck = normalizePhoneNumber(updates.phone);
    if (!phoneCheck.valid) {
      throw new Error(phoneCheck.error || 'Invalid phone number');
    }
    updatedPhone = phoneCheck.normalized;
  }

  const updatedContact = {
    ...target,
    name: updates.name !== undefined ? updates.name.trim() : target.name,
    phone: updatedPhone,
    relationship: updates.relationship !== undefined ? updates.relationship.trim() : target.relationship,
    updated_at: new Date().toISOString(),
  };

  contacts[targetIndex] = updatedContact;
  persistContacts(contacts);

  // If this was primary, update sos_contact as well
  const primary = getPrimaryContact();
  if (primary && String(primary.id) === String(id)) {
    try {
      localStorage.setItem(
        SOS_PRIMARY_STORAGE_KEY,
        JSON.stringify({
          id: updatedContact.id,
          name: updatedContact.name,
          phone: updatedContact.phone,
          relationship: updatedContact.relationship,
        })
      );
    } catch {}
  }

  notifyContactsUpdated();
  return updatedContact;
}

/**
 * Deletes an emergency contact.
 * If deleted contact was primary, automatically promotes the next available contact.
 *
 * @param {string|number} id
 * @returns {Object|null} Deleted contact
 */
export function deleteContact(id) {
  const contacts = getContacts();
  const deleted = contacts.find((c) => String(c.id) === String(id));
  if (!deleted) return null;

  const remaining = contacts.filter((c) => String(c.id) !== String(id));
  persistContacts(remaining);

  // Check if deleted contact was primary
  const primary = getPrimaryContact();
  const wasPrimary = primary && String(primary.id) === String(id);

  if (wasPrimary) {
    if (remaining.length > 0) {
      setPrimaryContact(remaining[0].id);
    } else {
      try {
        localStorage.removeItem(SOS_PRIMARY_STORAGE_KEY);
      } catch {}
      notifyContactsUpdated();
    }
  } else {
    notifyContactsUpdated();
  }

  return deleted;
}

export default {
  CONTACTS_STORAGE_KEY,
  SOS_PRIMARY_STORAGE_KEY,
  SOS_UPDATED_EVENT,
  notifyContactsUpdated,
  normalizePhoneNumber,
  getContacts,
  getPrimaryContact,
  setPrimaryContact,
  addContact,
  updateContact,
  deleteContact,
};
