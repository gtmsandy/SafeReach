/**
 * Silent SOS emergency flow.
 *
 * Flow:
 * 1. Read saved emergency contact.
 * 2. Try to obtain the user's location.
 * 3. Prepare an emergency SMS containing the location link.
 * 4. Trigger the emergency call.
 * 5. After the user returns to the app, open the SMS composer.
 *
 * Note:
 * tel: and sms: links behave fully only on supported mobile devices.
 * Desktop browsers may not have applications associated with these protocols.
 */

import { getPrimaryContact, normalizePhoneNumber } from './emergencyContacts.js';

function getSavedContact() {
  return getPrimaryContact() || {};
}

function getLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      () => {
        resolve(null);
      },
      {
        enableHighAccuracy: true,
        timeout: 7000,
        maximumAge: 60000,
      }
    );
  });
}

function buildEmergencyMessage(location) {
  let message =
    'EMERGENCY: I may need immediate help after a road accident. ';

  if (location) {
    message +=
      `My location: https://maps.google.com/?q=${location.lat},${location.lng}. `;
  } else {
    message +=
      'My live location could not be obtained. Please contact or locate me immediately. ';
  }

  message += 'Sent via SafeReach Emergency SOS.';

  return message;
}

function openEmergencyCall(number) {
  if (!number) return false;
  const cleaned = String(number).trim().replace(/[^\d+]/g, '');
  if (!cleaned) return false;
  window.location.href = `tel:${cleaned}`;
  return true;
}

function openEmergencySMS(phone, message) {
  if (!phone) return false;
  const check = normalizePhoneNumber(phone);
  if (!check.valid) return false;
  const encodedMessage = encodeURIComponent(message);
  window.location.href = `sms:${check.normalized}?body=${encodedMessage}`;
  return true;
}

/**
 * Trigger the SafeReach Silent SOS flow.
 *
 * @param {{ ambulance?: string, unified?: string }} country
 * @returns {Promise<{
 *   success: boolean,
 *   callTriggered: boolean,
 *   smsPrepared: boolean,
 *   locationAvailable: boolean
 * }>}
 */
export async function triggerSilentSOS(country) {
  const contact = getSavedContact();

  const emergencyNumber =
    country?.ambulance || country?.unified;

  if (!emergencyNumber) {
    console.error(
      'Silent SOS failed: no emergency number available.'
    );

    return {
      success: false,
      callTriggered: false,
      smsPrepared: false,
      locationAvailable: false,
    };
  }

  // Try to capture location before opening the phone dialer.
  const location = await getLocation();

  const message = buildEmergencyMessage(location);

  const callTriggered =
    openEmergencyCall(emergencyNumber);

  const phoneCheck = contact.phone ? normalizePhoneNumber(contact.phone) : { valid: false };

  if (phoneCheck.valid) {
    let smsOpened = false;

    const openSMSOnce = () => {
      if (smsOpened) return;
      smsOpened = true;
      window.removeEventListener('focus', handleFocus);
      openEmergencySMS(phoneCheck.normalized, message);
    };

    const handleFocus = () => {
      setTimeout(openSMSOnce, 400);
    };

    window.addEventListener('focus', handleFocus, { once: true });
    setTimeout(openSMSOnce, 2500);
  }

  return {
    success: callTriggered,
    callTriggered,
    smsPrepared: phoneCheck.valid,
    locationAvailable: Boolean(location),
  };
}

export default {
  triggerSilentSOS,
};