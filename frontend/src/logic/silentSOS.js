/**
 * Shared Silent SOS flow: call ambulance, then SMS emergency contact with location.
 * Works without data — uses cellular tel:/sms: links only.
 */

function getLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { timeout: 5000, maximumAge: 60000 }
    );
  });
}

/**
 * @param {{ ambulance?: string, unified?: string }} country
 * @returns {Promise<boolean>} true if SOS was triggered
 */
export async function triggerSilentSOS(country) {
  const contact = JSON.parse(localStorage.getItem('sos_contact') || '{}');
  const ambulanceNumber = country?.ambulance || country?.unified;
  if (!ambulanceNumber) return false;

  window.location.href = `tel:${ambulanceNumber}`;

  await new Promise((r) => setTimeout(r, 1500));

  if (!contact.phone) return true;

  const location = await getLocation();
  let body =
    'EMERGENCY: I have been in a road accident. ';
  if (location) {
    body += `My location: https://maps.google.com/?q=${location.lat},${location.lng}`;
  } else {
    body += 'My location unavailable — please track my phone';
  }
  body += ' — Sent via SafeReach';

  window.location.href = `sms:${contact.phone}?body=${encodeURIComponent(body)}`;
  return true;
}

export default { triggerSilentSOS };
