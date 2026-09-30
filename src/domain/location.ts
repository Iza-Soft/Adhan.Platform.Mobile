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
  /** Уточнение под името: „общ. Рудозем, обл. Смолян“ или държавата извън България. */
  detail?: { bg: string; en: string };
  latitude: number;
  longitude: number;
  source: TimeSource;
  /** Само за 'mufti': разлика в минути спрямо таблицата на София (Варна = −18). */
  muftiShift?: number;
}

/** „55.95°N 3.19°W“ – когато извън България няма име на мястото (без интернет). */
export function formatCoords(lat: number, lon: number): string {
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(2)}°${ns} ${Math.abs(lon).toFixed(2)}°${ew}`;
}
