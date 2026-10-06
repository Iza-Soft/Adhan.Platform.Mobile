import data from '@/data/hijri.json';

import type { HijriDate } from './hijri';

/**
 * Календарът по Хиджра от таблица (етап 13) – началото на всеки месец, а не изчисление
 * „горе-долу“. Таблицата е от tools/build-hijri.mjs:
 * - 'diyanet' – Диянет; същия календар ползва и Главно мюфтийство в България;
 * - 'ummalqura' – Умм ал-Кура (Саудитска Арабия). Там Рамазан, Шеввал и Зилхидже
 *   се обявяват по наблюдение на луната – таблицата е само очакване.
 */
export type HijriCalendar = 'diyanet' | 'ummalqura';

interface Table {
  firstYear: number;
  /** Дните от 1.1.1970 (UTC) на 1-во число на всеки месец, от Мухаррем на firstYear. */
  days: number[];
}

const DAY = 86400000;
const epochDay = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / DAY);
};

const TABLES: Record<HijriCalendar, Table> = {
  diyanet: { firstYear: data.diyanet.firstYear, days: data.diyanet.months.map(epochDay) },
  ummalqura: { firstYear: data.ummalqura.firstYear, days: data.ummalqura.months.map(epochDay) },
};

/** До кой месец Диянет е обявил датите официално; след него – по същите правила. */
export const DIYANET_OFFICIAL_UNTIL = { year: data.diyanet.officialUntil[0], month: data.diyanet.officialUntil[1] };

/** Денят (местна дата) като номер от 1.1.1970. */
export function localEpochDay(date: Date): number {
  return Math.round(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY);
}

/** Датата по Хиджра от таблицата; null – извън таблицата. */
export function hijriFromTable(date: Date, calendar: HijriCalendar): HijriDate | null {
  const { firstYear, days } = TABLES[calendar];
  const day = localEpochDay(date);
  // последният месец няма известен край – не го ползваме
  if (day < days[0] || day >= days[days.length - 1]) return null;
  let lo = 0;
  let hi = days.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (days[mid] <= day) lo = mid;
    else hi = mid;
  }
  return { year: firstYear + Math.floor(lo / 12), month: (lo % 12) + 1, day: day - days[lo] + 1 };
}

/** Григорианската дата (местна, 12:00) на ден по Хиджра; null – извън таблицата. */
export function gregorianFromTable(calendar: HijriCalendar, year: number, month: number, day: number): Date | null {
  const { firstYear, days } = TABLES[calendar];
  const i = (year - firstYear) * 12 + (month - 1);
  if (i < 0 || i >= days.length - 1) return null;
  const d = new Date((days[i] + day - 1) * DAY);
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12);
}

/** Годините по Хиджра, които таблицата покрива изцяло. */
export function tableYears(calendar: HijriCalendar): { first: number; last: number } {
  const { firstYear, days } = TABLES[calendar];
  return { first: firstYear, last: firstYear + Math.floor((days.length - 1) / 12) - 1 };
}
