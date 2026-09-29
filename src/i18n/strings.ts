import type { PrayerId } from '@/domain/prayers';
import type { AlertMode } from '@/store/alertPrefs';

/**
 * Всички текстове на приложението на двата езика.
 * `en` е типизиран като `Strings` (формата на `bg`), затова TypeScript
 * дава грешка, ако някой ключ липсва в единия от езиците.
 */
export const bg = {
  prayers: {
    fajr: 'Фаджр',
    sunrise: 'Изгрев',
    dhuhr: 'Зухр',
    asr: 'Аср',
    maghrib: 'Магриб',
    isha: 'Иша',
  } as Record<PrayerId, string>,

  alert: {
    off: 'без известие',
    notify: 'нотификация',
    adhan: 'езан',
  } as Record<AlertMode, string>,

  tabs: {
    today: 'Днес',
    qibla: 'Кибла',
    month: 'Месец',
    settings: 'Настройки',
  },

  hero: {
    next: 'Следваща',
    at: (time: string) => `в ${time}`,
    tomorrowAt: (time: string) => `утре в ${time}`,
    remaining: (time: string) => `Остават ${time}`,
  },

  nowPill: 'СЕГА',

  a11y: {
    city: (city: string) => `Град: ${city}. Смени града`,
    bell: (prayer: string, mode: string) => `${prayer}: ${mode}. Докосни за смяна`,
  },

  toast: (prayer: string, mode: string) => `${prayer}: ${mode}`,

  placeholder: {
    qibla: 'Компас към Кябе. Идва в етап 7 от плана.',
    month: 'Таблица с часовете за целия месец. Идва в етап 2 от плана.',
    settings: 'Метод, Аср, звуци, напомняне. Идва в етап 3 от плана.',
  },

  date: {
    weekdaysShort: ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'],
    // съкращенията са с точка; „март“, „май“, „юни“, „юли“ са пълни думи
    monthsShort: ['яну.', 'фев.', 'март', 'апр.', 'май', 'юни', 'юли', 'авг.', 'септ.', 'окт.', 'ное.', 'дек.'],
  },

  hijriMonths: [
    'Мухаррем',
    'Сафер',
    'Ребиул-евел',
    'Ребиул-ахир',
    'Джемазиел-евел',
    'Джемазиел-ахир',
    'Реджеб',
    'Шабан',
    'Рамазан',
    'Шеввал',
    'Зилкаде',
    'Зилхидже',
  ],
};

export type Strings = typeof bg;

export const en: Strings = {
  prayers: {
    fajr: 'Fajr',
    sunrise: 'Sunrise',
    dhuhr: 'Dhuhr',
    asr: 'Asr',
    maghrib: 'Maghrib',
    isha: 'Isha',
  },

  alert: {
    off: 'no alert',
    notify: 'notification',
    adhan: 'adhan',
  },

  tabs: {
    today: 'Today',
    qibla: 'Qibla',
    month: 'Month',
    settings: 'Settings',
  },

  hero: {
    next: 'Next',
    at: (time) => `at ${time}`,
    tomorrowAt: (time) => `tomorrow at ${time}`,
    remaining: (time) => `${time} left`,
  },

  nowPill: 'NOW',

  a11y: {
    city: (city) => `City: ${city}. Change city`,
    bell: (prayer, mode) => `${prayer}: ${mode}. Tap to change`,
  },

  toast: (prayer, mode) => `${prayer}: ${mode}`,

  placeholder: {
    qibla: 'Compass pointing to the Kaaba. Coming in stage 7.',
    month: 'Prayer times for the whole month. Coming in stage 2.',
    settings: 'Method, Asr, sounds, reminders. Coming in stage 3.',
  },

  date: {
    weekdaysShort: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    monthsShort: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  },

  hijriMonths: [
    'Muharram',
    'Safar',
    'Rabi al-Awwal',
    'Rabi al-Thani',
    'Jumada al-Ula',
    'Jumada al-Akhirah',
    'Rajab',
    'Shaban',
    'Ramadan',
    'Shawwal',
    'Dhu al-Qadah',
    'Dhu al-Hijjah',
  ],
};
