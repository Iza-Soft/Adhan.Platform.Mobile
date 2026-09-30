import data from '@/data/mufti.json';

import type { AppLocation } from './location';
import { PRAYER_IDS, type PrayerTime } from './prayers';

/**
 * Официалният календар на Главно мюфтийство.
 *
 * Как е устроен (виж src/data/mufti.json):
 * - `sofia` е таблица 365 × 6 – минути от полунощ за Фаджр, Изгрев, Зухр, Аср, Магриб, Иша,
 *   винаги в ЗИМНО време (UTC+2). Лятното време добавя телефонът според часовата зона.
 * - Всеки от 48-те града = таблицата на София + постоянна разлика `shift` в минути.
 * - Календарът е един и същ всяка година („вечен“ календар).
 */

export interface MuftiTown {
  id: string;
  bg: string;
  en: string;
  lat: number;
  lon: number;
  shift: number;
}

export const MUFTI_TOWNS: readonly MuftiTown[] = data.towns;
export const MUFTI_SOURCE: string = data.source;
const SOFIA: readonly (readonly number[])[] = data.sofia;

const DAYS_BEFORE_MONTH = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];

/** Редът от таблицата за дадена дата. 29 февруари го няма – взимаме средното на 28.02 и 01.03. */
function rowFor(date: Date): readonly number[] {
  const month = date.getMonth();
  const day = date.getDate();
  if (month === 1 && day === 29) {
    const feb28 = SOFIA[58];
    const mar1 = SOFIA[59];
    return feb28.map((v, k) => Math.round((v + mar1[k]) / 2));
  }
  return SOFIA[DAYS_BEFORE_MONTH[month] + day - 1];
}

/**
 * Часовете за един ден по календара на Мюфтийството.
 * Минутите са в UTC+2, затова UTC = минути − 120. Така се получава точен момент във времето,
 * който телефонът показва в своята часова зона (с лятното време, когато го има).
 */
export function computeMuftiDay(date: Date, shift: number): PrayerTime[] {
  const row = rowFor(date);
  const y = date.getFullYear();
  const m = date.getMonth();
  const d = date.getDate();
  return PRAYER_IDS.map((id, k) => ({
    id,
    time: new Date(Date.UTC(y, m, d, 0, row[k] + shift - 120)),
  }));
}

export function townToLocation(town: MuftiTown): AppLocation {
  return {
    id: town.id,
    names: { bg: town.bg, en: town.en },
    latitude: town.lat,
    longitude: town.lon,
    source: 'mufti',
    muftiShift: town.shift,
  };
}

export function findTown(id: string): MuftiTown | undefined {
  return MUFTI_TOWNS.find((t) => t.id === id);
}

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

export function nearestTown(lat: number, lon: number): { town: MuftiTown; km: number } {
  let best = MUFTI_TOWNS[0];
  let bestKm = Infinity;
  for (const t of MUFTI_TOWNS) {
    const km = distanceKm(lat, lon, t.lat, t.lon);
    if (km < bestKm) {
      best = t;
      bestKm = km;
    }
  }
  return { town: best, km: bestKm };
}

/**
 * Разликата за място в България, което не е в списъка (село, GPS):
 * най-близкият град + 4 минути за всеки градус географска дължина (на изток – по-рано).
 * Същото правило ползва и самото Мюфтийство за 48-те града.
 */
export function muftiShiftFor(lat: number, lon: number): number {
  const { town } = nearestTown(lat, lon);
  return town.shift - Math.round((lon - town.lon) * 4);
}
