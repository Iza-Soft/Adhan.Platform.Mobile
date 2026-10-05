import { formatHM } from './format';
import { getSchedule, PRAYERS, type PrayerId } from './prayers';
import { computeThreeDays, type TimesOptions } from './times';

/**
 * Widget-ите (етап 8) – какво показват във всеки момент.
 *
 * Приложението изчислява предварително „кадрите“ за следващите дни: нов кадър в часа на
 * всяка молитва (сменят се следващата молитва и фонът) и в полунощ (сменя се денят в списъка).
 * Android (Kotlin) и iPhone (WidgetKit) само показват кадъра, който важи в момента, а
 * оставащото време брои сама системата (Chronometer / Text с таймер) – без да буди приложението.
 */

/** Колко дни напред – widget-ът работи толкова, дори приложението да не се отваря. */
export const WIDGET_DAYS = 7;

export type WidgetRowState = 'past' | 'now' | 'next' | 'later';

export interface WidgetRow {
  id: PrayerId;
  name: string;
  time: string;
  state: WidgetRowState;
}

export interface WidgetEntry {
  /** От кога важи кадърът (ms). */
  from: number;
  /** Текущата молитва – по нея е фонът. */
  phase: PrayerId;
  /** Фонът: горе → среда (55%) → долу. */
  colors: readonly [string, string, string];
  /** „СОФИЯ“ */
  place: string;
  next: PrayerId;
  /** „Аср“ */
  nextName: string;
  /** „العصر“ */
  nextArabic: string;
  /** „16:33“ */
  nextTime: string;
  /** Часът на следващата молитва (ms) – до него брои оставащото време. */
  nextAt: number;
  /** Началото на текущата молитва (ms) – за дъгата на заключения екран. */
  prevAt: number;
  /** „Следваща“ */
  nextLabel: string;
  /** „в 16:33“ / „утре в 05:54“ */
  atText: string;
  /** „16:33“ / „утре 05:54“ */
  shortAt: string;
  /** „остават до Аср“ */
  untilText: string;
  /** „остават“ */
  leftLabel: string;
  /** Шестте часа за деня. */
  rows: WidgetRow[];
}

export interface WidgetTexts {
  prayers: Record<PrayerId, string>;
  next: string;
  at: (time: string) => string;
  tomorrowAt: (time: string) => string;
  tomorrowShort: (time: string) => string;
  until: (name: string) => string;
  left: string;
}

export interface WidgetInput {
  now: Date;
  options: TimesOptions;
  placeName: string;
  texts: WidgetTexts;
  gradients: Record<PrayerId, readonly [string, string, string]>;
  days?: number;
}

const dayAt = (d: Date, offset: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + offset);

/** Кадърът в момента `at`. */
export function widgetEntryAt(at: Date, input: Omit<WidgetInput, 'now' | 'days'>): WidgetEntry {
  const { texts } = input;
  const s = getSchedule(at, computeThreeDays(at, input.options));
  const nextTime = formatHM(s.next.time);
  const nextName = texts.prayers[s.next.id];
  return {
    from: at.getTime(),
    phase: s.current.id,
    colors: input.gradients[s.current.id],
    place: input.placeName.toLocaleUpperCase(),
    next: s.next.id,
    nextName,
    nextArabic: PRAYERS[s.next.id].arabic,
    nextTime,
    nextAt: s.next.time.getTime(),
    prevAt: s.current.time.getTime(),
    nextLabel: texts.next,
    atText: s.isNextTomorrow ? texts.tomorrowAt(nextTime) : texts.at(nextTime),
    shortAt: s.isNextTomorrow ? texts.tomorrowShort(nextTime) : nextTime,
    untilText: texts.until(nextName),
    leftLabel: texts.left,
    rows: s.today.map((p) => {
      const state = s.rowState(p.id);
      return {
        id: p.id,
        name: texts.prayers[p.id],
        time: formatHM(p.time),
        state:
          state === 'now'
            ? 'now'
            : state === 'past'
              ? 'past'
              : !s.isNextTomorrow && p.id === s.next.id
                ? 'next'
                : 'later',
      };
    }),
  };
}

/**
 * Кадрите от „сега“ до `days` дни напред. Първият кадър започва от последната смяна преди
 * `now` (началото на текущата молитва или полунощ), затова при едни и същи настройки
 * резултатът е един и същ през целия интервал – приложението не обновява widget-а напразно.
 */
export function planWidget(input: WidgetInput): WidgetEntry[] {
  const { now, options } = input;
  const days = input.days ?? WIDGET_DAYS;
  const t = now.getTime();

  // всички моменти на смяна: часовете на молитвите и полунощ, от вчера до `days` дни напред
  const changes = new Set<number>();
  for (let i = -1; i <= days; i++) {
    const day = dayAt(now, i);
    changes.add(day.getTime());
    const three = computeThreeDays(day, options);
    for (const p of three.today) changes.add(p.time.getTime());
  }
  const sorted = [...changes].sort((a, b) => a - b);
  const end = dayAt(now, days).getTime();
  const firstIdx = Math.max(0, sorted.findIndex((x) => x > t) - 1);
  const moments = sorted.slice(firstIdx).filter((x, i) => i === 0 || x <= end);

  const out: WidgetEntry[] = [];
  for (const m of moments) {
    const e = widgetEntryAt(new Date(m), input);
    // полунощ без промяна в нищо видимо – не е нужен нов кадър (напр. ако часовете са невалидни)
    const prev = out[out.length - 1];
    if (prev && sameView(prev, e)) continue;
    out.push(e);
  }
  return out;
}

function sameView(a: WidgetEntry, b: WidgetEntry): boolean {
  const { from: _a, ...ra } = a;
  const { from: _b, ...rb } = b;
  return JSON.stringify(ra) === JSON.stringify(rb);
}
