import { getLocales, useLocales } from 'expo-localization';

import { bg, en, type Strings } from './strings';
import { tr } from './tr';

export type Lang = 'bg' | 'en' | 'tr';

const STRINGS: Record<Lang, Strings> = { bg, en, tr };

/**
 * Правилото (етап 10): езикът на телефона – български → български, турски → турски,
 * всеки друг – английски.
 */
export function resolveLang(languageCode: string | null | undefined): Lang {
  const code = languageCode?.toLowerCase();
  return code === 'bg' ? 'bg' : code === 'tr' ? 'tr' : 'en';
}

/** Име на два (или три) езика – местата, звуците. Турското липсва → английското. */
export interface Localized {
  bg: string;
  en: string;
  tr?: string;
}

export function pickName(names: Localized, lang: Lang): string {
  if (lang === 'bg') return names.bg;
  if (lang === 'tr') return names.tr ?? names.en;
  return names.en;
}

/**
 * Текущият език и текстовете за него.
 * `useLocales()` прерисува компонента, когато потребителят смени езика на телефона
 * (или езика само за това приложение – Android 13+ / iOS).
 */
export function useI18n(): { lang: Lang; t: Strings; pick: (names: Localized) => string } {
  const locales = useLocales();
  const lang = resolveLang(locales[0]?.languageCode);
  return { lang, t: STRINGS[lang], pick: (names) => pickName(names, lang) };
}

export type { Strings };

/** Същото без React – за известията, които се планират и във фонов режим. */
export function getI18n(): { lang: Lang; t: Strings; pick: (names: Localized) => string } {
  const lang = resolveLang(getLocales()[0]?.languageCode);
  return { lang, t: STRINGS[lang], pick: (names) => pickName(names, lang) };
}
