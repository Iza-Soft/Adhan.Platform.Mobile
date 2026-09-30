/**
 * Молитвите и логиката „коя е сега / коя е следващата“.
 * Самите часове идват от src/domain/times.ts (календар на Мюфтийството или изчисление).
 */

/** Редът е важен: така се показват в списъка и така се търси „следваща“. */
export const PRAYER_IDS = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'] as const;
export type PrayerId = (typeof PRAYER_IDS)[number];

/** Имената на кирилица/латиница са в src/i18n/strings.ts (зависят от езика). */
export interface PrayerMeta {
  id: PrayerId;
  arabic: string;
  /** Изгрев е само нотификация, без езан/аларма (решение №2). */
  canAlarm: boolean;
}

export const PRAYERS: Record<PrayerId, PrayerMeta> = {
  fajr: { id: 'fajr', arabic: 'الفجر', canAlarm: true },
  sunrise: { id: 'sunrise', arabic: 'الشروق', canAlarm: false },
  dhuhr: { id: 'dhuhr', arabic: 'الظهر', canAlarm: true },
  asr: { id: 'asr', arabic: 'العصر', canAlarm: true },
  maghrib: { id: 'maghrib', arabic: 'المغرب', canAlarm: true },
  isha: { id: 'isha', arabic: 'العشاء', canAlarm: true },
};

export interface PrayerTime {
  id: PrayerId;
  time: Date;
}

export interface ThreeDays {
  yesterday: PrayerTime[];
  today: PrayerTime[];
  tomorrow: PrayerTime[];
}

export type RowState = 'past' | 'now' | 'upcoming';

export interface Schedule {
  today: PrayerTime[];
  /** Текущата молитва. Преди Фаджр това е Иша от вчера. */
  current: PrayerTime;
  /** Следващата молитва. След Иша това е Фаджр от утре. */
  next: PrayerTime;
  isNextTomorrow: boolean;
  /** 0..1 – колко от интервала current → next е изминал (за пръстена). */
  progress: number;
  remainingMs: number;
  rowState: (id: PrayerId) => RowState;
}

export function getSchedule(now: Date, days: ThreeDays): Schedule {
  const t = now.getTime();
  const { today } = days;

  const passed = today.filter((p) => p.time.getTime() <= t);
  const current = passed.length > 0 ? passed[passed.length - 1] : days.yesterday[5];

  const upcoming = today.find((p) => p.time.getTime() > t);
  const next = upcoming ?? days.tomorrow[0];

  const span = next.time.getTime() - current.time.getTime();
  const progress = span > 0 ? Math.min(1, Math.max(0, (t - current.time.getTime()) / span)) : 0;

  return {
    today,
    current,
    next,
    isNextTomorrow: !upcoming,
    progress,
    remainingMs: Math.max(0, next.time.getTime() - t),
    rowState: (id) => {
      if (id === current.id) return 'now';
      const row = today.find((p) => p.id === id)!;
      return row.time.getTime() <= t ? 'past' : 'upcoming';
    },
  };
}
