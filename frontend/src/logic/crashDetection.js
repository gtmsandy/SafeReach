/**
 * SafeReach Crash Detection
 * Uses DeviceMotionEvent API — no install, no extra library.
 * 
 * Algorithm:
 *   1. Measure baseline acceleration over 3 seconds on init
 *   2. On each subsequent event: if delta > threshold → probable crash
 *   3. Fire callback → renders CrashAlert overlay
 * 
 * iOS 13+: requires user gesture to request permission.
 * Fails gracefully if motion API unavailable.
 */

// Thresholds for each sensitivity level (m/s²)
const THRESHOLDS = {
  low: 35,
  medium: 25,
  high: 15,
};

let _listener = null;
let _baseline = { x: 0, y: 0, z: 0 };
let _baselineSamples = [];
let _calibrating = true;
let _calibrationTimer = null;
let _onCrashCallback = null;
let _sensitivity = 'medium';
let _enabled = false;
let _lastFired = 0;

const COOLDOWN_MS = 10000; // 10s between detections to avoid re-triggering

/**
 * Get iOS DeviceMotionEvent permission
 * Must be called from a user gesture (button tap).
 * @returns {Promise<'granted'|'denied'|'unavailable'>}
 */
export async function requestMotionPermission() {
  if (typeof DeviceMotionEvent === 'undefined') {
    return 'unavailable';
  }
  if (typeof DeviceMotionEvent.requestPermission !== 'function') {
    // Non-iOS or older iOS — permission not needed
    return 'granted';
  }
  try {
    const result = await DeviceMotionEvent.requestPermission();
    return result; // 'granted' | 'denied'
  } catch {
    return 'denied';
  }
}

/**
 * Check if crash detection is supported on this device/browser
 */
export function isSupported() {
  return typeof DeviceMotionEvent !== 'undefined';
}

/**
 * Initialize crash detection.
 * @param {Function} onCrash - called when a probable crash is detected
 * @param {{ sensitivity?: 'low'|'medium'|'high', enabled?: boolean }} options
 */
export function initCrashDetection(onCrash, options = {}) {
  _onCrashCallback = onCrash;
  _sensitivity = options.sensitivity || 'medium';
  _enabled = options.enabled !== false;

  if (!isSupported() || !_enabled) {
    console.info('[CrashDetection] Not supported or disabled — skipping.');
    return;
  }

  startListening();
}

function startListening() {
  if (_listener) {
    window.removeEventListener('devicemotion', _listener);
  }

  _calibrating = true;
  _baselineSamples = [];

  // Calibration window: collect samples for 3 seconds
  _calibrationTimer = setTimeout(() => {
    if (_baselineSamples.length > 0) {
      const n = _baselineSamples.length;
      _baseline = {
        x: _baselineSamples.reduce((s, v) => s + v.x, 0) / n,
        y: _baselineSamples.reduce((s, v) => s + v.y, 0) / n,
        z: _baselineSamples.reduce((s, v) => s + v.z, 0) / n,
      };
    }
    _calibrating = false;
    console.info('[CrashDetection] Calibration complete. Baseline:', _baseline);
  }, 3000);

  _listener = (event) => {
    const acc = event.accelerationIncludingGravity || event.acceleration;
    if (!acc) return;

    const { x = 0, y = 0, z = 0 } = acc;

    if (_calibrating) {
      _baselineSamples.push({ x, y, z });
      return;
    }

    if (!_enabled) return;

    // Delta from baseline
    const delta = Math.sqrt(
      Math.pow(x - _baseline.x, 2) +
      Math.pow(y - _baseline.y, 2) +
      Math.pow(z - _baseline.z, 2)
    );

    const threshold = THRESHOLDS[_sensitivity] || THRESHOLDS.medium;

    if (delta > threshold) {
      const now = Date.now();
      if (now - _lastFired > COOLDOWN_MS) {
        _lastFired = now;
        console.warn('[CrashDetection] Probable crash detected. Delta:', delta);
        _onCrashCallback && _onCrashCallback({ delta, threshold });
      }
    }
  };

  window.addEventListener('devicemotion', _listener, { passive: true });
}

/**
 * Stop crash detection (e.g., after SOS fired or user cancels)
 */
export function stopCrashDetection() {
  _enabled = false;
  if (_listener) {
    window.removeEventListener('devicemotion', _listener);
    _listener = null;
  }
  if (_calibrationTimer) {
    clearTimeout(_calibrationTimer);
    _calibrationTimer = null;
  }
}

/**
 * Re-enable crash detection (e.g., after false positive cleared)
 */
export function resumeCrashDetection() {
  _enabled = true;
  _lastFired = 0;
  startListening();
}

/**
 * Update sensitivity at runtime
 * @param {'low'|'medium'|'high'} level
 */
export function setSensitivity(level) {
  _sensitivity = level;
}

export default {
  initCrashDetection,
  stopCrashDetection,
  resumeCrashDetection,
  requestMotionPermission,
  isSupported,
  setSensitivity,
};
