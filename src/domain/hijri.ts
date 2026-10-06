import { hijriFromTable, type HijriCalendar } from './hijriTable';

/**
 * Дата по Хиджра.
 * 0) Етап 13: от таблицата на календара (src/domain/hijriTable.ts) – Диянет / Мюфтийството
 *    или Умм ал-Кура – точно като обявените дати. Изчисленията по-долу са само резерва
 *    извън годините на таблицата.
 * 1) Календарът Umm al-Qura през Intl (ако телефонът го поддържа).
 * 2) Иначе табличният („кувейтски“) алгоритъм, който е чисто аритметичен.
 * И двата могат да се разминат с 1–2 дни с датата, обявена от Мюфтийството
 * (тя зависи от наблюдението на луната). Затова има `adjustDays` –
 * в етап 2 става настройка „Корекция на датата по Хиджра“.
 * Имената на месеците са в src/i18n/strings.ts (hijriMonths).
 */

export interface HijriDate {
  day: number;
  month: number; // 1..12
  year: number;
}

function julianDayNumber(year: number, month: number, day: number): number {
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  return (
    day +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32045
  );
}

// Един форматер за цялото приложение: в Hermes създаването на Intl.DateTimeFormat е скъпо
// (за „Месец“ бяха 30 нови форматера при всяко показване). null = телефонът не го поддържа.
let formatter: Intl.DateTimeFormat | null | undefined;
function umalquraFormatter(): Intl.DateTimeFormat | null {
  if (formatter === undefined) {
    try {
      formatter = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', {
        day: 'numeric',
        month: 'numeric',
        year: 'numeric',
      });
    } catch {
      formatter = null;
    }
  }
  return formatter;
}

function fromIntl(date: Date): HijriDate | null {
  const f = umalquraFormatter();
  if (!f) return null;
  try {
    const parts = f.formatToParts(date);
    const num = (type: string) => parseInt(parts.find((p) => p.type === type)?.value ?? '', 10);
    const day = num('day');
    const month = num('month');
    const year = num('year');
    // проверка, че наистина е върнат ислямски календар, а не григориански
    if (!(day >= 1 && day <= 30 && month >= 1 && month <= 12 && year > 1400 && year < 1600)) {
      return null;
    }
    return { day, month, year };
  } catch {
    return null;
  }
}

/** Табличният алгоритъм (експортиран за тестовете). */
export function tabularHijri(date: Date): HijriDate {
  const jd = julianDayNumber(date.getFullYear(), date.getMonth() + 1, date.getDate());

  let l = jd - 1948440 + 10632;
  const n = Math.floor((l - 1) / 10631);
  l = l - 10631 * n + 354;
  const j =
    Math.floor((10985 - l) / 5316) * Math.floor((50 * l) / 17719) +
    Math.floor(l / 5670) * Math.floor((43 * l) / 15238);
  l =
    l -
    Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50) -
    Math.floor(j / 16) * Math.floor((15238 * j) / 43) +
    29;
  const month = Math.floor((24 * l) / 709);
  const day = l - Math.floor((709 * month) / 24);
  const year = 30 * n + j - 30;

  return { day, month, year };
}

export function toHijri(date: Date, adjustDays = 0, calendar: HijriCalendar = 'diyanet'): HijriDate {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate() + adjustDays, 12);
  return hijriFromTable(d, calendar) ?? fromIntl(d) ?? tabularHijri(d);
}

/** „17 Ребиул-ахир 1448“ или „17 Rabi al-Thani 1448“ */
export function formatHijri(
  date: Date,
  monthNames: readonly string[],
  adjustDays = 0,
  calendar: HijriCalendar = 'diyanet',
): string {
  const h = toHijri(date, adjustDays, calendar);
  return `${h.day} ${monthNames[h.month - 1]} ${h.year}`;
}
