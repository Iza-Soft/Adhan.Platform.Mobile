import { CalculationMethod, Coordinates, Madhab, PrayerTimes } from 'adhan';

import type { AppLocation } from './location';
import { PRAYER_IDS, type PrayerTime } from './prayers';

export type CalculationMethodId = 'Turkey' | 'MuslimWorldLeague' | 'Egyptian' | 'UmmAlQura';
export type AsrMadhab = 'shafi' | 'hanafi';

/**
 * Астрономическо изчисление с adhan – за места извън България.
 * Методът „Turkey“ (Диянет) вече съдържа предпазните минути (темкин) на Диянет.
 * Сравнено с календара на Мюфтийството за София, средната разлика е ~0,
 * но в отделни дни стига 2–4 мин. (виж docs/PLAN.md, етап 2).
 */
export function computeCalcDay(
  date: Date,
  location: AppLocation,
  method: CalculationMethodId,
  madhab: AsrMadhab,
): PrayerTime[] {
  const params = CalculationMethod[method]();
  params.madhab = madhab === 'hanafi' ? Madhab.Hanafi : Madhab.Shafi;
  const coords = new Coordinates(location.latitude, location.longitude);
  // обяд, за да не може смяната на лятно/зимно време да измести датата
  const noon = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  const pt = new PrayerTimes(coords, noon, params);
  return PRAYER_IDS.map((id) => ({ id, time: pt[id] }));
}
