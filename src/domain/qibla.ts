import { Coordinates, Qibla } from 'adhan';
import geomagnetism from 'geomagnetism';

import { distanceKm } from './geo';

/**
 * Кибла: посоката към Кааба и всичко около компаса – чиста математика, без сензори,
 * затова е покрито с тестове. Сензорите са в src/hooks/useCompass.ts.
 */

/** Кааба, Мека. */
export const KAABA = { latitude: 21.4225, longitude: 39.8262 };

/** До колко градуса разлика смятаме, че човек е обърнат към Кибла. */
export const ALIGN_DEG = 3;

/** Посоката към Кааба от север, по часовниковата стрелка (0–360°), по голямата окръжност. */
export function qiblaBearing(lat: number, lon: number): number {
  return Qibla(new Coordinates(lat, lon));
}

export function distanceToKaabaKm(lat: number, lon: number): number {
  return distanceKm(lat, lon, KAABA.latitude, KAABA.longitude);
}

/** 0–360 */
export function normalizeDeg(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/** Най-късата разлика от `from` до `to`: от −180 до 180 (положително = надясно). */
export function angleDelta(from: number, to: number): number {
  const d = normalizeDeg(to - from);
  return d > 180 ? d - 360 : d;
}

export interface TurnInstruction {
  /** Колко градуса да се завърти (винаги положително). */
  degrees: number;
  direction: 'left' | 'right';
  aligned: boolean;
}

/** Накъде и колко да се завърти човек, който гледа в `heading`, за да е към Кибла. */
export function turnInstruction(qibla: number, heading: number): TurnInstruction {
  const d = angleDelta(heading, qibla);
  return {
    degrees: Math.round(Math.abs(d)),
    direction: d >= 0 ? 'right' : 'left',
    aligned: Math.abs(d) <= ALIGN_DEG,
  };
}

/* ------------------------------------------------------------------ магнитно поле */

export interface MagneticInfo {
  /** Магнитна деклинация: колко градуса магнитният север е на изток от истинския. */
  declination: number;
  /** Очаквана сила на полето на това място (µT) – за проверка дали компасът е смутен. */
  fieldUT: number;
}

/**
 * Деклинация и сила на полето по World Magnetic Model (WMM 2025, валиден до 2029 г.).
 * В София ~+6°: без нея компасът би показал Киблата 6° встрани.
 */
export function magneticInfo(lat: number, lon: number, date = new Date()): MagneticInfo {
  const point = geomagnetism.model(date, { allowOutOfBoundsModel: true }).point([lat, lon]);
  return { declination: point.decl, fieldUT: point.f / 1000 };
}

/* ------------------------------------------------------------------ сензори (Android) */

type Vec = { x: number; y: number; z: number };

const cross = (a: Vec, b: Vec): Vec => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
const norm = (a: Vec) => Math.hypot(a.x, a.y, a.z);

/**
 * Посока на горния край на телефона спрямо МАГНИТНИЯ север (0–360°) от акселерометъра
 * и магнитометъра – същата формула като SensorManager.getRotationMatrix + getOrientation
 * в Android, с поправка за наклона. null, ако данните не стигат (свободно падане,
 * телефонът е изправен вертикално).
 * Осите са тези на Android: x – надясно, y – към горния край, z – от екрана навън.
 */
export function headingFromSensors(gravity: Vec, magnetic: Vec): number | null {
  const H = cross(magnetic, gravity); // изток
  const hNorm = norm(H);
  const gNorm = norm(gravity);
  if (hNorm < 0.1 || gNorm < 0.1) return null;
  const h = { x: H.x / hNorm, y: H.y / hNorm, z: H.z / hNorm };
  const a = { x: gravity.x / gNorm, y: gravity.y / gNorm, z: gravity.z / gNorm };
  const m = cross(a, h); // север
  return normalizeDeg((Math.atan2(h.y, m.y) * 180) / Math.PI);
}

/**
 * Изглаждане на посоката (кръгово, за да не „прескача“ през 0°/360°).
 * `factor` 0–1: колко от новата стойност да се вземе.
 */
export function smoothHeading(prev: number | null, next: number, factor = 0.2): number {
  if (prev === null) return next;
  return normalizeDeg(prev + angleDelta(prev, next) * factor);
}

export type CompassQuality = 'high' | 'medium' | 'low';

/**
 * Точност на компаса по силата на измереното поле спрямо очакваната за мястото:
 * метал, магнити и некалибриран сензор я отклоняват.
 */
export function qualityFromField(measuredUT: number, expectedUT: number): CompassQuality {
  const ratio = measuredUT / expectedUT;
  if (ratio > 0.8 && ratio < 1.2) return 'high';
  if (ratio > 0.6 && ratio < 1.45) return 'medium';
  return 'low';
}

/** Точност на iPhone (градуси грешка от CoreLocation). Отрицателна = неизвестна. */
export function qualityFromAccuracy(deg: number): CompassQuality {
  if (deg < 0) return 'low';
  if (deg <= 15) return 'high';
  if (deg <= 30) return 'medium';
  return 'low';
}
