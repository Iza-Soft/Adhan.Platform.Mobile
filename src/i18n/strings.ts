import type { CalculationMethodId, HighLatRuleId } from '@/domain/calc';
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

  busy: 'Зарежда…',
  locating: 'Определям мястото…',

  a11y: {
    city: (city: string) => `Град: ${city}. Смени града`,
    locating: 'Определям местоположението',
    bell: (prayer: string, mode: string) => `${prayer}: ${mode}. Докосни за смяна`,
  },

  toast: (prayer: string, mode: string) => `${prayer}: ${mode}`,

  placeholder: {
    qibla: 'Компас към Кябе. Идва в етап 7 от плана.',
  },

  month: {
    dayColumn: 'Ден',
    hijriColumn: 'Хиджра',
    today: 'Днес',
    prev: 'Предишен месец',
    next: 'Следващ месец',
    friday: 'петък',
    sourceMufti: 'Източник: Главно мюфтийство на Република България',
    sourceCalc: (method: string) => `Изчислено по метод ${method}`,
  },

  settings: {
    title: 'Настройки',
    groupPlace: 'Място',
    groupTimes: 'Часове',
    groupCorrections: 'Корекции',
    groupApp: 'Приложение',
    about: 'За приложението',
    change: 'Смени мястото',
    auto: 'Автоматично (GPS)',
    autoHint: 'Мястото се определя при отваряне на приложението.',
    locating: 'Определям местоположението…',
    denied: 'Няма разрешение за местоположение.',
    openSettings: 'Отвори настройките на телефона',
    unavailable: 'Местоположението не може да се определи. Показва се последното известно място.',
    refresh: 'Обнови местоположението',
    sourceMufti: 'Календар на Главно мюфтийство',
    sourceMuftiNote: 'В България часовете са по официалния календар. Методът и Аср се избират само извън България.',
    sourceCalc: 'Изчисление за мястото',
    method: 'Метод',
    asr: 'Аср',
    shafi: 'Шафии, Малики, Ханбали',
    hanafi: 'Ханафи',
    shafiDesc: 'Сянката е равна на предмета – „първият“ Аср, като в календара на Диянет',
    hanafiDesc: 'Сянката е два пъти по-дълга – около час по-късно',
    asrNote: 'Шафии, Малики и Ханбали смятат Аср еднакво; само при Ханафи е по-късно.',
    polarNote: (lat: string) =>
      `На ${lat}° ширина има полярен ден и полярна нощ. В дните без изгрев или залез часовете са изчислени за 65° ширина – най-близките места с нормален ден и нощ. Сверете с местната джамия.`,
    highLat: 'Северни ширини',
    highLatNote: (lat: string) =>
      `На ${lat}° ширина през лятото няма истински здрач и правилото определя Фаджр и Иша. Сверете с местната джамия.`,
    offsetsNote: 'Ако джамията ти е с няколко минути по-различна, нагласи тук. Важи за всички екрани.',
    minutes: (n: number) => (n === 0 ? '0 мин' : `${n > 0 ? '+' : ''}${n} мин`),
    hijri: 'Дата по Хиджра',
    days: (n: number) => (n === 0 ? '0 дни' : `${n > 0 ? '+' : ''}${n} ${Math.abs(n) === 1 ? 'ден' : 'дни'}`),
    hijriNote: 'Ако датата по Хиджра се разминава с обявената от Мюфтийството.',
    hijriNoteAbroad: 'Ако датата по Хиджра се разминава с обявената от местната джамия.',
    reset: 'Нулирай корекциите',
    decrease: (label: string) => `Намали: ${label}`,
    increase: (label: string) => `Увеличи: ${label}`,
  },

  about: {
    title: 'За приложението',
    name: 'Езан',
    back: 'Настройки',
    version: (v: string) => `Версия ${v}`,
    tagline: 'Часове за намаз, напомняния и езан',
    groupTimes: 'Източници на часовете',
    groupPlaces: 'Данни за местата',
    groupPrivacy: 'Поверителност',
    sources: {
      mufti: { name: 'Главно мюфтийство на Република България', desc: 'Календар за намаз – часовете в България' },
      adhan: { name: 'adhan', desc: 'Изчисление извън България · лиценз MIT' },
      osm: { name: 'OpenStreetMap', desc: 'Населени места в България · © OpenStreetMap contributors, ODbL' },
      ne: { name: 'Natural Earth', desc: 'Граница на България · public domain' },
    },
    privacy:
      'Местоположението се ползва само на телефона – за да се изберат населеното място и часовете. Приложението не го изпраща никъде. Извън България телефонът пита своята картова услуга за името на града.',
  },

  methods: {
    Turkey: 'Диянет (Турция)',
    MuslimWorldLeague: 'Muslim World League',
    MoonsightingCommittee: 'Moonsighting Committee',
    Egyptian: 'Египетски генерален орган',
    Karachi: 'Университет в Карачи',
    UmmAlQura: 'Umm al-Qura (Мека)',
    NorthAmerica: 'ISNA (Северна Америка)',
  } as Record<CalculationMethodId, string>,

  highLatRules: {
    seventhofthenight: { name: 'Една седма от нощта', desc: 'Най-често ползваното в Европа' },
    middleofthenight: { name: 'Средата на нощта', desc: 'Фаджр и Иша не минават средата на нощта' },
    twilightangle: { name: 'По ъгъла на здрача', desc: 'Част от нощта според ъгъла на метода' },
  } as Record<HighLatRuleId, { name: string; desc: string }>,

  place: {
    title: 'Избери място',
    search: 'Търси населено място в България',
    useGps: 'Използвай местоположението ми (GPS)',
    cities: 'Градове',
    noResults: 'Няма такова населено място',
    abroadNote: 'Извън България мястото се определя с GPS.',
    close: 'Затвори',
  },

  date: {
    weekdaysShort: ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'],
    // съкращенията са с точка; „март“, „май“, „юни“, „юли“ са пълни думи
    monthsShort: ['яну.', 'фев.', 'март', 'апр.', 'май', 'юни', 'юли', 'авг.', 'септ.', 'окт.', 'ное.', 'дек.'],
    monthsFull: ['Януари', 'Февруари', 'Март', 'Април', 'Май', 'Юни', 'Юли', 'Август', 'Септември', 'Октомври', 'Ноември', 'Декември'],
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

  busy: 'Loading…',
  locating: 'Finding your location…',

  a11y: {
    city: (city) => `City: ${city}. Change city`,
    locating: 'Finding your location',
    bell: (prayer, mode) => `${prayer}: ${mode}. Tap to change`,
  },

  toast: (prayer, mode) => `${prayer}: ${mode}`,

  placeholder: {
    qibla: 'Compass pointing to the Kaaba. Coming in stage 7.',
  },

  month: {
    dayColumn: 'Day',
    hijriColumn: 'Hijri',
    today: 'Today',
    prev: 'Previous month',
    next: 'Next month',
    friday: 'Friday',
    sourceMufti: 'Source: Grand Mufti of Bulgaria',
    sourceCalc: (method) => `Calculated with the ${method} method`,
  },

  settings: {
    title: 'Settings',
    groupPlace: 'Location',
    groupTimes: 'Prayer times',
    groupCorrections: 'Adjustments',
    groupApp: 'App',
    about: 'About',
    change: 'Change location',
    auto: 'Automatic (GPS)',
    autoHint: 'Your location is detected when the app opens.',
    locating: 'Detecting your location…',
    denied: 'Location permission is off.',
    openSettings: 'Open phone settings',
    unavailable: 'Your location could not be detected. Showing the last known place.',
    refresh: 'Update location',
    sourceMufti: 'Grand Mufti of Bulgaria calendar',
    sourceMuftiNote: 'In Bulgaria the official calendar is used. Method and Asr apply only outside Bulgaria.',
    sourceCalc: 'Calculated for this place',
    method: 'Method',
    asr: 'Asr',
    shafi: "Shafi'i, Maliki, Hanbali",
    hanafi: 'Hanafi',
    shafiDesc: 'Shadow equal to the object – the "first" Asr, as in the Diyanet calendar',
    hanafiDesc: 'Shadow twice the object – about an hour later',
    asrNote: "Shafi'i, Maliki and Hanbali calculate Asr the same way; only Hanafi is later.",
    polarNote: (lat) =>
      `At ${lat}° latitude there are polar days and nights. On days without sunrise or sunset, times are calculated for 65° latitude – the nearest places with a normal day and night. Check with your local mosque.`,
    highLat: 'High latitudes',
    highLatNote: (lat) =>
      `At ${lat}° latitude there is no true twilight in summer, so this rule sets Fajr and Isha. Check with your local mosque.`,
    offsetsNote: 'If your mosque differs by a few minutes, adjust it here. Applies to all screens.',
    minutes: (n) => (n === 0 ? '0 min' : `${n > 0 ? '+' : ''}${n} min`),
    hijri: 'Hijri date',
    days: (n) => (n === 0 ? '0 days' : `${n > 0 ? '+' : ''}${n} ${Math.abs(n) === 1 ? 'day' : 'days'}`),
    hijriNote: 'If the Hijri date differs from the one announced by the Grand Mufti of Bulgaria.',
    hijriNoteAbroad: 'If the Hijri date differs from the one announced by your local mosque.',
    reset: 'Reset adjustments',
    decrease: (label) => `Decrease: ${label}`,
    increase: (label) => `Increase: ${label}`,
  },

  about: {
    title: 'About',
    name: 'Adhan',
    back: 'Settings',
    version: (v: string) => `Version ${v}`,
    tagline: 'Prayer times, reminders and the adhan',
    groupTimes: 'Prayer time sources',
    groupPlaces: 'Place data',
    groupPrivacy: 'Privacy',
    sources: {
      mufti: { name: 'Grand Mufti of Bulgaria', desc: 'Prayer calendar – times in Bulgaria' },
      adhan: { name: 'adhan', desc: 'Calculation outside Bulgaria · MIT license' },
      osm: { name: 'OpenStreetMap', desc: 'Places in Bulgaria · © OpenStreetMap contributors, ODbL' },
      ne: { name: 'Natural Earth', desc: 'Border of Bulgaria · public domain' },
    },
    privacy:
      'Your location is used only on the phone to pick the place and the prayer times. The app does not send it anywhere. Outside Bulgaria the phone asks its map service for the city name.',
  },

  methods: {
    Turkey: 'Diyanet (Turkey)',
    MuslimWorldLeague: 'Muslim World League',
    MoonsightingCommittee: 'Moonsighting Committee',
    Egyptian: 'Egyptian General Authority',
    Karachi: 'University of Karachi',
    UmmAlQura: 'Umm al-Qura (Makkah)',
    NorthAmerica: 'ISNA (North America)',
  },

  highLatRules: {
    seventhofthenight: { name: 'Seventh of the night', desc: 'Most common in Europe' },
    middleofthenight: { name: 'Middle of the night', desc: 'Fajr and Isha never pass midnight' },
    twilightangle: { name: 'Twilight angle', desc: 'Share of the night based on the method angle' },
  },

  place: {
    title: 'Choose location',
    search: 'Search a place in Bulgaria',
    useGps: 'Use my location (GPS)',
    cities: 'Cities',
    noResults: 'No such place',
    abroadNote: 'Outside Bulgaria your location comes from GPS.',
    close: 'Close',
  },

  date: {
    weekdaysShort: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    monthsShort: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    monthsFull: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
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
