import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './en.json';
import bn from './bn.json';
import th from './th.json';
import ne from './ne.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      bn: { translation: bn },
      th: { translation: th },
      ne: { translation: ne },
    },
    fallbackLng: 'en',
    supportedLngs: ['en', 'bn', 'th', 'ne'],
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'safereach_lang',
    },
    interpolation: {
      escapeValue: false, // React already escapes
    },
  });

export default i18n;

/**
 * Language display names for the language selector
 */
export const LANGUAGES = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'bn', label: 'Bengali', native: 'বাংলা' },
  { code: 'th', label: 'Thai', native: 'ไทย' },
  { code: 'ne', label: 'Nepali', native: 'नेपाली' },
];
