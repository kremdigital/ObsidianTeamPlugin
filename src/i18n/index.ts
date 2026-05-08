import ruDict from './ru.json';
import enDict from './en.json';
import type { Language } from '@/settings/settings';

/**
 * Tiny translation helper. Russian is the source of truth — every key the
 * UI uses is asserted against `ru.json` by `tests/i18n-coverage.test.ts`.
 * English is a parallel catalog at the same set of keys; if a key drifts
 * out of `en.json` we fall back to the Russian copy, then to the raw
 * key — meaning a missing translation is loud (the key surfaces in the
 * UI) but never throws.
 *
 * Replace with i18next or similar if the catalog grows past a few hundred
 * keys.
 *
 * Usage:
 *   t('settings.title')
 *   t('settings.servers.test.success', { email: 'foo@bar.com' })
 */

type Catalog = Record<string, string>;

const catalogs: Record<Language, Catalog> = {
  ru: ruDict as Catalog,
  en: enDict as Catalog,
};

let currentLanguage: Language = 'ru';

export function setLanguage(lang: Language): void {
  currentLanguage = lang;
}

export function getLanguage(): Language {
  return currentLanguage;
}

/**
 * Look up a translation. Falls back to the Russian catalog, then to the raw
 * key — meaning a missing translation is loud (the key shows up in the UI)
 * but never throws.
 */
export function t(key: string, params?: Record<string, string | number>): string {
  const primary = catalogs[currentLanguage]?.[key];
  const fallback = catalogs.ru?.[key];
  const template = primary ?? fallback ?? key;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_match, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : `{${name}}`,
  );
}
