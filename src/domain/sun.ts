import { angleDelta, normalizeDeg } from './qibla';

/**
 * Слънцето спрямо Киблата: къде е слънцето в момента и в колко часа днес е точно
 * в посоката на Кааба. Изчислява се на телефона, без интернет
 * (формулите на NOAA / Meeus с ниска точност, около 0,1° – с много запас за компас).
 */

const RAD = Math.PI / 180;
const DAY_MS = 86_400_000;
const J2000 = Date.UTC(2000, 0, 1, 12);

/** Под тази височина слънцето е зад хоризонта (с пречупването в атмосферата). */
export const SUN_HORIZON = -0.833;
/** Слънце по-ниско от това е зад сгради и дървета – не е полезен ориентир. */
export const SUN_MIN_ALTITUDE = 5;
/** „Сега“: до 5 минути преди или след точния момент. */
export const SUN_NOW_MS = 5 * 60_000;

export interface SunPosition {
  /** От север, по часовниковата стрелка, 0–360°. */
  azimuth: number;
  /** Височина над хоризонта в градуси (отрицателна = под хоризонта). */
  altitude: number;
}

export function sunPosition(date: Date, lat: number, lon: number): SunPosition {
  const n = (date.getTime() - J2000) / DAY_MS;
  const meanLon = normalizeDeg(280.46 + 0.9856474 * n);
  const g = normalizeDeg(357.528 + 0.9856003 * n) * RAD;
  const lambda = (meanLon + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * RAD;
  const eps = (23.439 - 0.0000004 * n) * RAD;

  const ra = Math.atan2(Math.cos(eps) * Math.sin(lambda), Math.cos(lambda));
  const dec = Math.asin(Math.sin(eps) * Math.sin(lambda));
  const gmst = normalizeDeg(280.46061837 + 360.98564736629 * n);
  const ha = (gmst + lon) * RAD - ra;
  const phi = lat * RAD;

  const altitude = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(ha));
  const azimuth = Math.atan2(-Math.sin(ha), Math.tan(dec) * Math.cos(phi) - Math.sin(phi) * Math.cos(ha));
  return { azimuth: normalizeDeg(azimuth / RAD), altitude: altitude / RAD };
}

export const isSunUp = (p: SunPosition) => p.altitude > SUN_HORIZON;

/**
 * Кога в този ден (местно време на телефона) слънцето е точно в посоката `azimuth`
 * и поне на `minAltitude` над хоризонта. null, ако не минава оттам
 * (например далеч на север през зимата или когато е твърде ниско).
 */
export function sunAtAzimuth(
  day: Date,
  lat: number,
  lon: number,
  azimuth: number,
  minAltitude = SUN_MIN_ALTITUDE,
): Date | null {
  const start = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
  const end = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1).getTime();
  const STEP = 5 * 60_000;
  const diff = (t: number) => angleDelta(azimuth, sunPosition(new Date(t), lat, lon).azimuth);

  let prevT = start;
  let prev = diff(start);
  for (let t = start + STEP; t <= end; t += STEP) {
    const cur = diff(t);
    // смяна на знака близо до посоката (а не скокът ±180° от другата страна)
    if (Math.sign(cur) !== Math.sign(prev) && Math.abs(cur) < 45 && Math.abs(prev) < 45) {
      let lo = prevT;
      let hi = t;
      let loVal = prev;
      for (let i = 0; i < 20; i++) {
        const mid = (lo + hi) / 2;
        const v = diff(mid);
        if (Math.sign(v) === Math.sign(loVal)) {
          lo = mid;
          loVal = v;
        } else {
          hi = mid;
        }
      }
      // до минута – така, както се показва
      const at = new Date(Math.round((lo + hi) / 2 / 60_000) * 60_000);
      if (sunPosition(at, lat, lon).altitude >= minAltitude) return at;
    }
    prevT = t;
    prev = cur;
  }
  return null;
}

export interface SunQiblaHint {
  /** now – точно сега (±5 мин), today – по-късно днес, tomorrow – утре. */
  kind: 'now' | 'today' | 'tomorrow';
  time: Date;
}

/** Какво да пише в картата със слънцето на екрана „Кибла“. null – картата не се показва. */
export function sunQiblaHint(now: Date, lat: number, lon: number, qibla: number): SunQiblaHint | null {
  const today = sunAtAzimuth(now, lat, lon, qibla);
  if (today) {
    const diff = today.getTime() - now.getTime();
    if (Math.abs(diff) <= SUN_NOW_MS) return { kind: 'now', time: today };
    if (diff > 0) return { kind: 'today', time: today };
  }
  const tomorrowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 12);
  const tomorrow = sunAtAzimuth(tomorrowDay, lat, lon, qibla);
  return tomorrow ? { kind: 'tomorrow', time: tomorrow } : null;
}

/**
 * Истинският (астрономически) изгрев: когато горният ръб на слънцето се покаже над
 * хоризонта. Не е часът „Изгрев“ от календара на Мюфтийството – той е няколко минути
 * по-рано нарочно (предпазен интервал за края на сутрешната молитва).
 * null при полярен ден или нощ.
 */
export function sunriseTime(day: Date, lat: number, lon: number): Date | null {
  const start = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
  const end = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1).getTime();
  const STEP = 10 * 60_000;
  const alt = (t: number) => sunPosition(new Date(t), lat, lon).altitude - SUN_HORIZON;
  let prevT = start;
  let prev = alt(start);
  for (let t = start + STEP; t <= end; t += STEP) {
    const cur = alt(t);
    if (prev < 0 && cur >= 0) {
      let lo = prevT;
      let hi = t;
      for (let i = 0; i < 16; i++) {
        const mid = (lo + hi) / 2;
        if (alt(mid) < 0) lo = mid;
        else hi = mid;
      }
      return new Date(Math.round(hi / 60_000) * 60_000);
    }
    prevT = t;
    prev = cur;
  }
  return null;
}

export interface SunriseBearing {
  /** Посоката на изгрева, 0–360°. */
  azimuth: number;
  /** С колко градуса Киблата е встрани от изгрева (винаги положително). */
  degrees: number;
  /** От коя страна на изгрева е Киблата, ако гледаш към него. */
  side: 'left' | 'right' | 'same';
}

/** Къде изгрява слънцето в този ден спрямо Киблата. null при полярен ден или нощ. */
export function sunriseBearing(day: Date, lat: number, lon: number, qibla: number): SunriseBearing | null {
  const sunrise = sunriseTime(day, lat, lon);
  if (!sunrise) return null;
  const { azimuth } = sunPosition(sunrise, lat, lon);
  const d = angleDelta(azimuth, qibla);
  const degrees = Math.round(Math.abs(d));
  return { azimuth, degrees, side: degrees <= 2 ? 'same' : d > 0 ? 'right' : 'left' };
}
