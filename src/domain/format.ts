/**
 * Форматиране без Intl: имената на дни и месеци идват от src/i18n/strings.ts,
 * за да изглеждат еднакво на всички телефони (Intl в Hermes зависи от устройството).
 */
export interface DateNames {
  weekdaysShort: readonly string[]; // 0 = неделя
  monthsShort: readonly string[];
}

const pad = (n: number) => String(n).padStart(2, '0');

/** 19:13 – 24-часов формат и на двата езика. */
export function formatHM(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** 01:49:12 */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

/** „Пн, 28 септ.“ или „Mon, 28 Sep“ */
export function formatGregorianShort(date: Date, names: DateNames): string {
  return `${names.weekdaysShort[date.getDay()]}, ${date.getDate()} ${names.monthsShort[date.getMonth()]}`;
}
