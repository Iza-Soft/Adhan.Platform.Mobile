import { computeCalcDay, type AsrMadhab, type CalculationMethodId, type HighLatRuleId } from './calc';
import type { AppLocation } from './location';
import { computeMuftiDay } from './mufti';
import type { PrayerId, PrayerTime, ThreeDays } from './prayers';

export interface TimesOptions {
  location: AppLocation;
  /** Само за source 'calc'. */
  method: CalculationMethodId;
  /** Само за source 'calc'. В България Аср е винаги по календара на Мюфтийството. */
  madhab: AsrMadhab;
  /** Само за source 'calc' и ширина над 48°. */
  highLatRule?: HighLatRuleId;
  /** Ръчни корекции в минути (+/−) за всяка молитва. Настройва се в етап 3. */
  offsets?: Partial<Record<PrayerId, number>>;
}

const MINUTE = 60_000;

/** Единственото място, което решава откъде идват часовете за даден ден. */
export function computeDay(date: Date, opts: TimesOptions): PrayerTime[] {
  const { location } = opts;
  const base =
    location.source === 'mufti'
      ? computeMuftiDay(date, location.muftiShift ?? 0)
      : computeCalcDay(date, location, opts.method, opts.madhab, opts.highLatRule);

  if (!opts.offsets) return base;
  return base.map((p) => {
    const off = opts.offsets?.[p.id] ?? 0;
    return off ? { id: p.id, time: new Date(p.time.getTime() + off * MINUTE) } : p;
  });
}

const dayAt = (d: Date, offset: number) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate() + offset, 12);

export function computeThreeDays(now: Date, opts: TimesOptions): ThreeDays {
  return {
    yesterday: computeDay(dayAt(now, -1), opts),
    today: computeDay(dayAt(now, 0), opts),
    tomorrow: computeDay(dayAt(now, 1), opts),
  };
}

export interface MonthDay {
  date: Date; // обяд на съответния ден
  times: PrayerTime[];
}

/** Всички дни от месеца (month: 0 = януари). */
export function computeMonth(year: number, month: number, opts: TimesOptions): MonthDay[] {
  const days = new Date(year, month + 1, 0).getDate();
  const out: MonthDay[] = [];
  for (let d = 1; d <= days; d++) {
    const date = new Date(year, month, d, 12);
    out.push({ date, times: computeDay(date, opts) });
  }
  return out;
}
