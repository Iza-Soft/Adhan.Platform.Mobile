import { getLocales, useLocales } from 'expo-localization';

import { bg, en, type Strings } from './strings';

export type Lang = 'bg' | 'en';

const STRINGS: Record<Lang, Strings> = { bg, en };

/**
 * Правилото: ако основният език на телефона е български – български,
 * за всеки друг език – английски.
 */
export function resolveLang(languageCode: string | null | undefined): Lang {
  return languageCode?.toLowerCase() === 'bg' ? 'bg' : 'en';
}

/**
 * Текущият език и текстовете за него.
 * `useLocales()` прерисува компонента, когато потребителят смени езика на телефона
 * (или езика само за това приложение – Android 13+ / iOS).
 */
export function useI18n(): { lang: Lang; t: Strings } {
  const locales = useLocales();
  const lang = resolveLang(locales[0]?.languageCode);
  return { lang, t: STRINGS[lang] };
}

export type { Strings };

/** Същото без React – за известията, които се планират и във фонов режим. */
export function getI18n(): { lang: Lang; t: Strings } {
  const lang = resolveLang(getLocales()[0]?.languageCode);
  return { lang, t: STRINGS[lang] };
}
