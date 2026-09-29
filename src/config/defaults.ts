/**
 * Стойности по подразбиране, докато няма екран за настройки и GPS (етапи 2 и 3 от плана).
 */
export type CalculationMethodId = 'Turkey' | 'MuslimWorldLeague' | 'Egyptian' | 'UmmAlQura';
export type AsrMadhab = 'shafi' | 'hanafi';

export interface AppLocation {
  id: string;
  /** Името на града на двата езика (градовете са данни, а не текстове на интерфейса). */
  names: { bg: string; en: string };
  latitude: number;
  longitude: number;
}

export const DEFAULT_LOCATION: AppLocation = {
  id: 'sofia',
  names: { bg: 'София', en: 'Sofia' },
  latitude: 42.6977,
  longitude: 23.3219,
};

/**
 * Диянет (Турция) е най-близо до практиката в България. Сверете с календара на Мюфтийството (етап 2).
 * Официалните календари на Диянет ползват „първия“ Аср (сянка ×1), т.е. изчислението по Шафии,
 * затова това е подразбиращата се стойност. Ханафи (сянка ×2) дава Аср около час по-късно.
 */
export const DEFAULT_METHOD: CalculationMethodId = 'Turkey';
export const DEFAULT_MADHAB: AsrMadhab = 'shafi';
