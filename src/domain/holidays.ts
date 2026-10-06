import { gregorianFromTable, localEpochDay, type HijriCalendar } from './hijriTable';

/**
 * Ислямските празници и свещени нощи (етап 13).
 *
 * Датите са от таблицата на календара по Хиджра (src/domain/hijriTable.ts) – за България
 * това е календарът на Мюфтийството (= Диянет), обявен предварително. Свещените нощи
 * (кандили) са вечерта на посочения ден – нощта преди следващия ден по Хиджра.
 */

export type HolidayId =
  | 'threeMonths'
  | 'regaib'
  | 'miraj'
  | 'berat'
  | 'ramadan'
  | 'qadr'
  | 'fitrEve'
  | 'fitr'
  | 'arafah'
  | 'adha'
  | 'newYear'
  | 'ashura'
  | 'mawlid';

export const HOLIDAY_IDS: readonly HolidayId[] = [
  'threeMonths',
  'regaib',
  'miraj',
  'berat',
  'ramadan',
  'qadr',
  'fitrEve',
  'fitr',
  'arafah',
  'adha',
  'newYear',
  'ashura',
  'mawlid',
];

/** Чии дати: Мюфтийството и Диянет са един и същ календар; Умм ал-Кура – Саудитска Арабия. */
export type HolidaySource = 'mufti' | 'diyanet' | 'ummalqura';
export type HolidaySourceChoice = 'auto' | HolidaySource;

/** Страни, които следват обявяванията на Саудитска Арабия. */
const UMM_AL_QURA_COUNTRIES = new Set(['SA', 'AE', 'KW', 'QA', 'BH', 'YE']);

/** „Автоматично“: България → Мюфтийството; Саудитска Арабия и Залива → Умм ал-Кура; другаде → Диянет. */
export function resolveHolidaySource(choice: HolidaySourceChoice, country: string | null): HolidaySource {
  if (choice !== 'auto') return choice;
  if (country === 'BG') return 'mufti';
  if (country && UMM_AL_QURA_COUNTRIES.has(country)) return 'ummalqura';
  return 'diyanet';
}

export function calendarOf(source: HolidaySource): HijriCalendar {
  return source === 'ummalqura' ? 'ummalqura' : 'diyanet';
}

export interface HolidayMeta {
  arabic: string;
  /** Свещена нощ – вечерта на датата. */
  night: boolean;
  /** Колко дни (Байрамите). */
  days: number;
  /** Месецът по Хиджра – за Умм ал-Кура Рамазан, Шеввал и Зилхидже са „очаквани“. */
  month: number;
}

export const HOLIDAYS: Record<HolidayId, HolidayMeta> = {
  threeMonths: { arabic: 'رجب', night: false, days: 1, month: 7 },
  regaib: { arabic: 'ليلة الرغائب', night: true, days: 1, month: 7 },
  miraj: { arabic: 'ليلة المعراج', night: true, days: 1, month: 7 },
  berat: { arabic: 'ليلة البراءة', night: true, days: 1, month: 8 },
  ramadan: { arabic: 'رمضان', night: false, days: 1, month: 9 },
  qadr: { arabic: 'ليلة القدر', night: true, days: 1, month: 9 },
  fitrEve: { arabic: 'عشية العيد', night: false, days: 1, month: 9 },
  fitr: { arabic: 'عيد الفطر', night: false, days: 3, month: 10 },
  arafah: { arabic: 'يوم عرفة', night: false, days: 1, month: 12 },
  adha: { arabic: 'عيد الأضحى', night: false, days: 4, month: 12 },
  newYear: { arabic: 'رأس السنة الهجرية', night: false, days: 1, month: 1 },
  ashura: { arabic: 'عاشوراء', night: false, days: 1, month: 1 },
  mawlid: { arabic: 'المولد النبوي', night: true, days: 1, month: 3 },
};

export interface Holiday {
  id: HolidayId;
  /** Първият ден (местна дата, 12:00). При свещена нощ – денят, чиято вечер е нощта. */
  date: Date;
  /** Последният ден (= date при еднодневните). */
  end: Date;
  /** Датата по Хиджра на първия ден. */
  hijri: { day: number; month: number; year: number };
  night: boolean;
  /** Умм ал-Кура: началото на Рамазан, Шеввал и Зилхидже се обявява по наблюдение. */
  expected: boolean;
}

const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, 12);

/** Празниците на една година по Хиджра. Липсва в таблицата → празен списък. */
export function holidaysOfHijriYear(source: HolidaySource, year: number): Holiday[] {
  const cal = calendarOf(source);
  const g = (month: number, day: number) => gregorianFromTable(cal, year, month, day);
  const out: Holiday[] = [];
  const add = (id: HolidayId, date: Date | null, hijri: { day: number; month: number }) => {
    if (!date) return;
    const meta = HOLIDAYS[id];
    out.push({
      id,
      date,
      end: addDays(date, meta.days - 1),
      hijri: { ...hijri, year },
      night: meta.night,
      expected: source === 'ummalqura' && [9, 10, 12].includes(meta.month),
    });
  };

  const rajab1 = g(7, 1);
  add('threeMonths', rajab1, { month: 7, day: 1 });
  if (rajab1) {
    // Регаиб: нощта срещу първия петък на Реджеб – четвъртък вечер
    const firstFriday = addDays(rajab1, (5 - rajab1.getDay() + 7) % 7);
    const regaib = addDays(firstFriday, -1);
    const day = localEpochDay(regaib) - localEpochDay(rajab1) + 1;
    // ако 1 Реджеб е петък, четвъртъкът е последният ден на Джемазиел-ахир
    const jumada1 = g(6, 1);
    add(
      'regaib',
      regaib,
      day >= 1 || !jumada1 ? { month: 7, day: Math.max(1, day) } : { month: 6, day: localEpochDay(regaib) - localEpochDay(jumada1) + 1 },
    );
  }
  add('miraj', g(7, 26), { month: 7, day: 26 });
  add('berat', g(8, 14), { month: 8, day: 14 });
  add('ramadan', g(9, 1), { month: 9, day: 1 });
  add('qadr', g(9, 26), { month: 9, day: 26 });
  const shawwal1 = g(10, 1);
  if (shawwal1) {
    const eve = addDays(shawwal1, -1);
    const ram1 = g(9, 1);
    add('fitrEve', eve, { month: 9, day: ram1 ? localEpochDay(eve) - localEpochDay(ram1) + 1 : 29 });
  }
  add('fitr', shawwal1, { month: 10, day: 1 });
  add('arafah', g(12, 9), { month: 12, day: 9 });
  add('adha', g(12, 10), { month: 12, day: 10 });
  add('newYear', g(1, 1), { month: 1, day: 1 });
  add('ashura', g(1, 10), { month: 1, day: 10 });
  add('mawlid', g(3, 11), { month: 3, day: 11 });
  return out;
}

/** Празниците с първи ден в дадената година (по Григорианския календар), по ред. */
export function holidaysInYear(source: HolidaySource, year: number): Holiday[] {
  // една година по Григорианския календар засяга 2 години по Хиджра (понякога 3)
  const approx = Math.floor(((year - 622) * 33) / 32);
  const all: Holiday[] = [];
  for (let hy = approx - 1; hy <= approx + 2; hy++) all.push(...holidaysOfHijriYear(source, hy));
  return all.filter((h) => h.date.getFullYear() === year).sort((a, b) => a.date.getTime() - b.date.getTime());
}

/** Следващият празник от днес нататък (днешният също – докато не е минал). */
export function nextHoliday(source: HolidaySource, now: Date): Holiday | null {
  const today = localEpochDay(now);
  for (const y of [now.getFullYear(), now.getFullYear() + 1]) {
    const h = holidaysInYear(source, y).find((x) => localEpochDay(x.end) >= today);
    if (h) return h;
  }
  return null;
}

/** След колко дни (0 – днес). */
export function daysUntil(h: Holiday, now: Date): number {
  return localEpochDay(h.date) - localEpochDay(now);
}

/** Денят на напомнянето: свещена нощ – същата вечер; празник – вечерта преди. */
export function reminderDayOf(h: Holiday): Date {
  return h.night ? h.date : addDays(h.date, -1);
}
