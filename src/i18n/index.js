// src/i18n/index.js
//
// Настройка i18n-js. Язык берётся из сохранённого выбора пользователя,
// иначе — язык устройства, иначе — английский.

import { I18n } from 'i18n-js';
import * as Localization from 'expo-localization';
import * as SecureStore from 'expo-secure-store';

import { translations, LANGUAGE_NAMES } from './translations';

export const SUPPORTED = ['en', 'ru', 'uk', 'es', 'fr', 'de', 'it', 'ar', 'zh'];
export { LANGUAGE_NAMES };

const LANG_KEY = 'app_language';
const RTL_LOCALES = ['ar'];

export const i18n = new I18n(translations, {
  defaultLocale: 'en',
  enableFallback: true,
});

export const isRTL = () => RTL_LOCALES.includes(i18n.locale);

function deviceLanguage() {
  try {
    for (const l of Localization.getLocales()) {
      if (SUPPORTED.includes(l.languageCode)) return l.languageCode;
    }
  } catch (e) {
    // на всякий случай
  }
  return 'en';
}

const listeners = new Set();
export function onLocaleChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function setLocale(code) {
  if (!SUPPORTED.includes(code)) return;
  i18n.locale = code;
  SecureStore.setItemAsync(LANG_KEY, code).catch(() => {});
  listeners.forEach((fn) => fn(code));
}

export async function initLocale() {
  let stored = null;
  try {
    stored = await SecureStore.getItemAsync(LANG_KEY);
  } catch (e) {
    // нет доступа к хранилищу — не страшно
  }
  i18n.locale = SUPPORTED.includes(stored) ? stored : deviceLanguage();
  listeners.forEach((fn) => fn(i18n.locale));
  return i18n.locale;
}

// Короткий доступ для не-компонентного кода (errors.js, aiService.js).
export const t = (key, opts) => i18n.t(key, opts);
