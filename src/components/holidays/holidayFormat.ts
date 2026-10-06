import type { Holiday } from '@/domain/holidays';
import type { Strings } from '@/i18n';

/** Плочката отляво: „10“ / „Чт“ или „20–22“ / „Пт–Нд“. */
export function dayTile(h: Holiday, t: Strings): { day: string; wd: string } {
  const wd = t.date.weekdaysShort;
  if (h.end.getTime() === h.date.getTime()) return { day: String(h.date.getDate()), wd: wd[h.date.getDay()] };
  return { day: `${h.date.getDate()}–${h.end.getDate()}`, wd: `${wd[h.date.getDay()]}–${wd[h.end.getDay()]}` };
}

/** „Чт, 10 дек.“ */
export function shortDate(d: Date, t: Strings): string {
  return `${t.date.weekdaysShort[d.getDay()]}, ${d.getDate()} ${t.date.monthsShort[d.getMonth()]}`;
}

/** „Ср, 27 – Сб, 30 май 2026“ / „Чт, 10 дек. 2026“ */
export function fullDate(h: Holiday, t: Strings): string {
  const y = h.end.getFullYear();
  if (h.end.getTime() === h.date.getTime()) return `${shortDate(h.date, t)} ${y}`;
  const wd = t.date.weekdaysShort;
  const sameMonth = h.date.getMonth() === h.end.getMonth();
  const from = sameMonth ? `${wd[h.date.getDay()]}, ${h.date.getDate()}` : shortDate(h.date, t);
  return `${from} – ${shortDate(h.end, t)} ${y}`;
}

/** „26 Реджеб 1447“ / „1–3 Шеввал 1447“ */
export function hijriText(h: Holiday, t: Strings): string {
  const days = Math.round((h.end.getTime() - h.date.getTime()) / 86400000);
  const day = days > 0 ? `${h.hijri.day}–${h.hijri.day + days}` : String(h.hijri.day);
  return `${day} ${t.hijriMonths[h.hijri.month - 1]} ${h.hijri.year}`;
}

/** Редът под името: „вечерта · 26 Реджеб 1447“; с датата – „Чт, 10 дек. · вечерта · 1 Реджеб 1448“. */
export function hijriLine(h: Holiday, t: Strings, withDate: boolean): string {
  return [withDate ? shortDate(h.date, t) : null, h.night ? t.holidays.evening : null, hijriText(h, t)].filter(Boolean).join(' · ');
}
