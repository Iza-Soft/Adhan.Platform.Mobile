/**
 * Откъде идват часовете за едно място:
 * - 'mufti' – официалният календар на Главно мюфтийство (всички места в България);
 * - 'calc'  – астрономическо изчисление с adhan (извън България).
 */
export type TimeSource = 'mufti' | 'calc';

export interface AppLocation {
  id: string;
  /** Името на мястото на двата езика (градовете са данни, а не текстове на интерфейса). */
  names: { bg: string; en: string };
  latitude: number;
  longitude: number;
  source: TimeSource;
  /** Само за 'mufti': разлика в минути спрямо таблицата на София (Варна = −18). */
  muftiShift?: number;
}
