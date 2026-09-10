import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mock DOM environment for Node.js test runner
const store = {};
let dispatchedEvents = [];
const classListSet = new Set();
const attributesMap = new Map();
let metaContent = '';

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

globalThis.document = {
  documentElement: {
    classList: {
      add: (cls) => classListSet.add(cls),
      remove: (cls) => classListSet.delete(cls),
      contains: (cls) => classListSet.has(cls),
    },
    setAttribute: (name, val) => attributesMap.set(name, String(val)),
    getAttribute: (name) => attributesMap.get(name) || null,
  },
  querySelector: (selector) => {
    if (selector === 'meta[name="theme-color"]') {
      return {
        setAttribute: (name, val) => {
          if (name === 'content') metaContent = val;
        },
        getAttribute: (name) => (name === 'content' ? metaContent : null),
      };
    }
    return null;
  },
};

globalThis.window = {
  matchMedia: (query) => ({
    matches: false,
    media: query,
  }),
  dispatchEvent: (event) => {
    dispatchedEvents.push(event);
    return true;
  },
};

globalThis.CustomEvent = class CustomEvent {
  constructor(type, options = {}) {
    this.type = type;
    this.detail = options.detail || {};
  }
};

import {
  THEME_STORAGE_KEY,
  THEME_CHANGE_EVENT,
  getInitialTheme,
  setTheme,
  applyTheme,
  toggleTheme,
  initTheme,
} from '../theme.js';

test('1. Theme persistence logic: default, saved, and storage keys', () => {
  globalThis.localStorage.clear();
  classListSet.clear();
  attributesMap.clear();

  assert.equal(THEME_STORAGE_KEY, 'safereach_theme');
  assert.equal(THEME_CHANGE_EVENT, 'safereach_theme_changed');

  // Default fallback when nothing is saved
  assert.equal(getInitialTheme(), 'light');

  // When 'dark' is saved
  globalThis.localStorage.setItem(THEME_STORAGE_KEY, 'dark');
  assert.equal(getInitialTheme(), 'dark');

  // When 'light' is saved
  globalThis.localStorage.setItem(THEME_STORAGE_KEY, 'light');
  assert.equal(getInitialTheme(), 'light');

  // Invalid value falls back to default
  globalThis.localStorage.setItem(THEME_STORAGE_KEY, 'invalid_mode');
  assert.equal(getInitialTheme(), 'light');
});

test('2. Light theme selection: sets storage, DOM, and dispatches event', () => {
  globalThis.localStorage.clear();
  dispatchedEvents = [];
  classListSet.clear();
  attributesMap.clear();

  const selected = setTheme('light');
  assert.equal(selected, 'light');
  assert.equal(globalThis.localStorage.getItem(THEME_STORAGE_KEY), 'light');
  assert.equal(classListSet.has('dark'), false);
  assert.equal(attributesMap.get('data-theme'), 'light');
  assert.equal(metaContent, '#1B3A5C');

  // Event dispatched
  assert.equal(dispatchedEvents.length, 1);
  assert.equal(dispatchedEvents[0].type, THEME_CHANGE_EVENT);
  assert.equal(dispatchedEvents[0].detail.theme, 'light');
});

test('3. Dark theme selection: sets storage, DOM, and dispatches event', () => {
  globalThis.localStorage.clear();
  dispatchedEvents = [];
  classListSet.clear();
  attributesMap.clear();

  const selected = setTheme('dark');
  assert.equal(selected, 'dark');
  assert.equal(globalThis.localStorage.getItem(THEME_STORAGE_KEY), 'dark');
  assert.equal(classListSet.has('dark'), true);
  assert.equal(attributesMap.get('data-theme'), 'dark');
  assert.equal(metaContent, '#0A1628');

  // Event dispatched
  assert.equal(dispatchedEvents.length, 1);
  assert.equal(dispatchedEvents[0].type, THEME_CHANGE_EVENT);
  assert.equal(dispatchedEvents[0].detail.theme, 'dark');

  // Toggle from dark transitions to light
  const toggled = toggleTheme('dark');
  assert.equal(toggled, 'light');
  assert.equal(globalThis.localStorage.getItem(THEME_STORAGE_KEY), 'light');
  assert.equal(classListSet.has('dark'), false);
});

test('4. Theme state application to document root element', () => {
  classListSet.clear();
  attributesMap.clear();

  applyTheme('dark');
  assert.equal(classListSet.has('dark'), true);
  assert.equal(attributesMap.get('data-theme'), 'dark');

  applyTheme('light');
  assert.equal(classListSet.has('dark'), false);
  assert.equal(attributesMap.get('data-theme'), 'light');

  // initTheme executes getInitialTheme and applies it
  globalThis.localStorage.setItem(THEME_STORAGE_KEY, 'dark');
  const initial = initTheme();
  assert.equal(initial, 'dark');
  assert.equal(classListSet.has('dark'), true);
  assert.equal(attributesMap.get('data-theme'), 'dark');
});

test('5. Invalid route resolves to NotFound through the existing routing architecture', () => {
  const appPath = path.resolve(__dirname, '../../App.jsx');
  const appSource = fs.readFileSync(appPath, 'utf8');

  // Verify NotFound import
  assert.ok(
    appSource.includes("import NotFound from './components/NotFound'"),
    'App.jsx must import NotFound component'
  );

  // Verify catch-all wildcard route
  assert.ok(
    /<Route\s+path=["']\*["']\s+element=\{<NotFound\s*\/>\}\s*\/>/.test(appSource),
    'App.jsx must configure a wildcard Route path="*" element={<NotFound />}'
  );
});

test('6. NotFound Home action points to the correct home route and uses SafeReach visual system', () => {
  const notFoundPath = path.resolve(__dirname, '../../components/NotFound.jsx');
  const notFoundSource = fs.readFileSync(notFoundPath, 'utf8');

  // Verify navigation to home '/'
  assert.ok(
    notFoundSource.includes("navigate('/')"),
    'NotFound must navigate to home root "/" on action'
  );

  // Verify button IDs and semantic structure
  assert.ok(
    notFoundSource.includes('id="btn-notfound-home"'),
    'NotFound must include id="btn-notfound-home"'
  );
  assert.ok(
    notFoundSource.includes('id="btn-notfound-back"'),
    'NotFound must include id="btn-notfound-back"'
  );
  assert.ok(
    notFoundSource.includes('t(\'page_not_found\')'),
    'NotFound must use i18n key page_not_found'
  );
  assert.ok(
    notFoundSource.includes('t(\'return_home\')'),
    'NotFound must use i18n key return_home'
  );
  assert.ok(
    notFoundSource.includes('className="screen"'),
    'NotFound must use SafeReach screen container'
  );
  assert.ok(
    notFoundSource.includes('className="topbar"'),
    'NotFound must use SafeReach topbar'
  );

  // Verify NotFound does NOT trigger emergency actions
  assert.ok(!notFoundSource.includes('triggerSilentSOS'), 'NotFound must never trigger SOS');
  assert.ok(!notFoundSource.includes('tel:'), 'NotFound must not show emergency dial links');
});

test('7. Translation consistency: Unit 7 keys present in all BIMSTEC languages', () => {
  const i18nDir = path.resolve(__dirname, '../../i18n');
  const en = JSON.parse(fs.readFileSync(path.join(i18nDir, 'en.json'), 'utf8'));
  const bn = JSON.parse(fs.readFileSync(path.join(i18nDir, 'bn.json'), 'utf8'));
  const ne = JSON.parse(fs.readFileSync(path.join(i18nDir, 'ne.json'), 'utf8'));
  const th = JSON.parse(fs.readFileSync(path.join(i18nDir, 'th.json'), 'utf8'));

  const requiredKeys = [
    'theme',
    'light',
    'dark',
    'switch_to_light',
    'switch_to_dark',
    'page_not_found',
    'page_not_found_description',
    'return_home',
  ];

  for (const key of requiredKeys) {
    assert.ok(en[key], `en.json must contain key ${key}`);
    assert.ok(bn[key], `bn.json must contain key ${key}`);
    assert.ok(ne[key], `ne.json must contain key ${key}`);
    assert.ok(th[key], `th.json must contain key ${key}`);
  }
});

test('8. ThemeToggle component structure and accessibility', () => {
  const togglePath = path.resolve(__dirname, '../../components/ThemeToggle.jsx');
  const toggleSource = fs.readFileSync(togglePath, 'utf8');

  assert.ok(toggleSource.includes('id="btn-theme-light"'), 'ThemeToggle must have btn-theme-light');
  assert.ok(toggleSource.includes('id="btn-theme-dark"'), 'ThemeToggle must have btn-theme-dark');
  assert.ok(toggleSource.includes('role="radiogroup"'), 'ThemeToggle must have role="radiogroup"');
  assert.ok(toggleSource.includes('role="radio"'), 'ThemeToggle buttons must have role="radio"');
  assert.ok(toggleSource.includes('aria-checked='), 'ThemeToggle must indicate checked state');
  assert.ok(toggleSource.includes('minHeight: 44'), 'ThemeToggle buttons must have >=44px touch target');
});
