import { formatHM } from './format';
import { holidaysInYear, reminderDayOf, type HolidayId, type HolidaySource } from './holidays';
import { PRAYER_IDS, PRAYERS, type PrayerId } from './prayers';
import { computeDay, type TimesOptions } from './times';

/**
 * Планът на известията – чиста функция, без expo-notifications, за да се тества.
 * Службата (src/services/notifications.ts) само го изпраща към телефона.
 */

/** Режимът на камбанката (виж src/store/alertPrefs.ts). */
export type AlertMode = 'off' | 'notify' | 'adhan';

/** Кой звук: кратък сигнал или езан (в етап 4 – временен звук). */
export type SoundKind = 'chime' | 'adhan';

export type NotificationKind = 'prayer' | 'reminder' | 'refresh' | 'holiday';

export interface PlannedNotification {
  /** Стабилен идентификатор: „ezan-20261001-maghrib-prayer“. */
  id: string;
  at: Date;
  kind: NotificationKind;
  prayer: PrayerId | null;
  sound: SoundKind;
  title: string;
  body: string;
}

/** Текстовете на известията (идват от src/i18n/strings.ts). */
export interface NotificationTexts {
  prayers: Record<PrayerId, string>;
  prayerTitle: (prayer: string, time: string) => string;
  /** „Време е за Иша (العشاء) · София“ */
  prayerBody: (prayer: string, arabic: string, place: string) => string;
  sunriseBody: (place: string) => string;
  /** Вторият ред: „Следваща: Фаджр в 05:37 (утре)“ */
  nextLine: (prayer: string, time: string, tomorrow: boolean) => string;
  reminderTitle: (prayer: string, minutes: number, time: string) => string;
  reminderBody: (place: string) => string;
  refreshTitle: string;
  refreshBody: string;
}

export interface PlanInput {
  now: Date;
  options: TimesOptions;
  modes: Record<PrayerId, AlertMode>;
  /** Напомняне X минути преди молитвата; 0 = без напомняне. */
  reminderMinutes: number;
  placeName: string;
  texts: NotificationTexts;
  /**
   * Колко известия най-много. iOS пази до 64 чакащи известия на приложение;
   * оставяме място за пробното известие.
   */
  limit?: number;
  /** За колко дни напред (от днес). */
  days?: number;
}

export const NOTIFICATION_LIMIT = 62;
export const PLAN_DAYS = 7;
/** Известие по-рано от това (напр. след 2 сек.) не се планира – няма смисъл. */
const MIN_LEAD_MS = 5_000;

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;

/**
 * Всички известия за следващите дни, по ред на часа, до `limit`.
 * Ако не се събират всички, последното място е за напомняне „отвори приложението“ –
 * на iPhone без него известията биха спрели тихо след ~5 дни, ако приложението не се отваря.
 */
export function planNotifications(input: PlanInput): PlannedNotification[] {
  const { now, options, modes, reminderMinutes, placeName, texts } = input;
  const limit = input.limit ?? NOTIFICATION_LIMIT;
  const days = input.days ?? PLAN_DAYS;
  const earliest = now.getTime() + MIN_LEAD_MS;

  const dayAt = (d: number) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + d, 12);
  const all: PlannedNotification[] = [];
  // денят след последния е нужен само за реда „Следваща: Фаджр … (утре)“
  let next = computeDay(dayAt(0), options);
  for (let d = 0; d < days; d++) {
    const date = dayAt(d);
    const day = next;
    next = computeDay(dayAt(d + 1), options);
    PRAYER_IDS.forEach((id, i) => {
      const mode = modes[id];
      if (mode === 'off') return;
      const time = day[i].time;
      const name = texts.prayers[id];
      const hm = formatHM(time);
      const key = `ezan-${ymd(date)}-${id}`;
      const following = i + 1 < day.length ? day[i + 1] : next[0];
      const nextLine = texts.nextLine(
        texts.prayers[following.id],
        formatHM(following.time),
        i + 1 >= day.length,
      );

      if (reminderMinutes > 0) {
        all.push({
          id: `${key}-reminder`,
          at: new Date(time.getTime() - reminderMinutes * 60_000),
          kind: 'reminder',
          prayer: id,
          sound: 'chime',
          title: texts.reminderTitle(name, reminderMinutes, hm),
          body: texts.reminderBody(placeName),
        });
      }
      all.push({
        id: `${key}-prayer`,
        at: time,
        kind: 'prayer',
        prayer: id,
        // изгревът е само известие, без езан (виж PRAYERS.sunrise.canAlarm)
        sound: mode === 'adhan' && id !== 'sunrise' ? 'adhan' : 'chime',
        title: texts.prayerTitle(name, hm),
        body:
          (id === 'sunrise' ? texts.sunriseBody(placeName) : texts.prayerBody(name, PRAYERS[id].arabic, placeName)) +
          '\n' +
          nextLine,
      });
    });
  }

  const upcoming = all
    .filter((n) => !isNaN(n.at.getTime()) && n.at.getTime() >= earliest)
    .sort((a, b) => a.at.getTime() - b.at.getTime());

  if (upcoming.length <= limit) return upcoming;

  const kept = upcoming.slice(0, limit - 1);
  const last = kept[kept.length - 1];
  kept.push({
    id: 'ezan-refresh',
    at: new Date(last.at.getTime() + 2 * 60_000),
    kind: 'refresh',
    prayer: null,
    sound: 'chime',
    title: texts.refreshTitle,
    body: texts.refreshBody,
  });
  return kept;
}

/**
 * „Отпечатък“ на плана: ако е същият като вече изпратения, не пренасрочваме
 * (иначе всяко отваряне на приложението би трило и създавало 60 известия).
 */
export function planSignature(plan: PlannedNotification[], extra: string): string {
  return (
    extra +
    '|' +
    plan.map((n) => `${n.id}@${n.at.getTime()}:${n.sound}:${n.title}:${n.body}`).join('|')
  );
}

/* ------------------------------------------------------------------ празници (етап 13) */

export interface HolidayReminderInput {
  now: Date;
  options: TimesOptions;
  source: HolidaySource;
  /** За кои празници е включено напомнянето (всеки поотделно). */
  enabled: Partial<Record<HolidayId, boolean>>;
  texts: {
    names: Record<HolidayId, string>;
    about: Record<HolidayId, string>;
    notifyTonight: (name: string) => string;
    notifyTomorrow: (name: string) => string;
  };
  /** За колко дни напред. */
  days?: number;
}

export const HOLIDAY_PLAN_DAYS = 30;

/**
 * Напомнянията за празниците: при Магриб – свещената нощ същата вечер („Тази вечер: Нощ Регаиб“),
 * празникът – вечерта преди („Утре: Курбан Байрам“).
 */
export function planHolidayReminders(input: HolidayReminderInput): PlannedNotification[] {
  const { now, options, source, enabled, texts } = input;
  const days = input.days ?? HOLIDAY_PLAN_DAYS;
  if (!Object.values(enabled).some(Boolean)) return [];
  const until = now.getTime() + days * 86_400_000;
  const out: PlannedNotification[] = [];
  for (const year of [now.getFullYear(), now.getFullYear() + 1]) {
    for (const h of holidaysInYear(source, year)) {
      if (!enabled[h.id]) continue;
      const day = reminderDayOf(h);
      if (day.getTime() > until + 86_400_000) continue;
      const maghrib = computeDay(day, options)[PRAYER_IDS.indexOf('maghrib')].time;
      if (isNaN(maghrib.getTime()) || maghrib.getTime() < now.getTime() + MIN_LEAD_MS || maghrib.getTime() > until) continue;
      const name = texts.names[h.id];
      out.push({
        id: `ezan-holiday-${ymd(h.date)}-${h.id}`,
        at: maghrib,
        kind: 'holiday',
        prayer: null,
        sound: 'chime',
        title: h.night ? texts.notifyTonight(name) : texts.notifyTomorrow(name),
        body: texts.about[h.id],
      });
    }
  }
  return out.sort((a, b) => a.at.getTime() - b.at.getTime());
}

