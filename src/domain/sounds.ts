import type { PrayerId } from './prayers';

/**
 * Звуците на Езан (етап 6).
 *
 * Два вида:
 * - 'full'  – пълни звуци (целият езан, мелодии с всякаква дължина). Свири ги само истинската
 *             аларма на Android (етап 5). Файловете са в assets/sounds/full → res/raw.
 * - 'short' – кратки звуци до 30 сек. Свирят като звук на известие: на iPhone (там звукът на
 *             известие е най-много 30 сек.) и на Android без „Аларми и напомняния“.
 *             Файловете са в assets/sounds (wav) – в списъка на expo-notifications в app.json.
 *
 * Потребителят може да добави и свои звуци (виж src/services/sounds.ts): на Android – пълни,
 * на iPhone – кратки (до 30 сек.).
 */

export type SoundKind = 'full' | 'short';
export type SoundCategory = 'adhan' | 'takbir' | 'chime' | 'custom';

/** Специалният „файл“ на звука на телефона (системният звук за известия). */
export const SYSTEM_SOUND = 'system';
/** Своят звук за известия – до 10 сек.; по-дълъг не се добавя. */
export const NOTIFY_MAX_SEC = 10;

/** На iPhone звукът на известие може да е най-много 30 сек. – иначе iOS пуска стандартния. */
export const SHORT_MAX_SEC = 30;
/** Своят пълен звук – до 15 мин. (алармата спира предпазно след 15 мин.) и до 60 MB. */
export const FULL_MAX_SEC = 15 * 60;
export const MAX_UPLOAD_BYTES = 60 * 1024 * 1024;

export interface SoundDef {
  id: string;
  kind: SoundKind;
  category: SoundCategory;
  names: { bg: string; en: string; tr?: string };
  /**
   * Вграден: името на файла без разширение („adhan_makkah“ – res/raw на Android, а за кратките
   * и „takbir_makkah.wav“ в приложението за iPhone).
   * Свой: пълният път до файла (file://…) – на Android; на iPhone – името в Library/Sounds.
   */
  file: string;
  /** Разширението на вградения кратък звук (за expo-notifications). */
  ext?: string;
  durationSec: number;
  /** Свой звук на iPhone, скъсен до 30 сек.: колко е бил. */
  originalSec?: number;
  custom?: boolean;
  /** Свой звук: за алармата или за известията. */
  use?: SoundUse;
}

/** Вграден звук за известията: assets/sounds/notify_<key>.wav. */
function notifySound(key: string, bg: string, en: string, tr: string, durationSec: number): SoundDef {
  return {
    id: `notify_${key}`,
    kind: 'short',
    category: 'chime',
    names: { bg, en, tr },
    file: `notify_${key}`,
    ext: 'wav',
    durationSec,
  };
}

/**
 * Вградените звуци. Записите на езан Мека, Медина и Ал-Акса са от колекцията на
 * PrayTimes.org, Истанбул – източникът да се уточни; изчистени, с изравнена сила (−16 LUFS);
 * откъсите с текбирите са отрязани на пауза (виж PLAN.md – произходът им
 * трябва да се потвърди преди публикуване).
 */
export const BUILTIN_SOUNDS: readonly SoundDef[] = [
  // ---- пълни (само Android)
  {
    id: 'adhan_makkah',
    kind: 'full',
    category: 'adhan',
    names: { bg: 'Езан · Мека', en: 'Adhan · Makkah', tr: 'Ezan · Mekke' },
    file: 'adhan_makkah',
    durationSec: 201,
  },
  {
    id: 'adhan_madinah',
    kind: 'full',
    category: 'adhan',
    names: { bg: 'Езан · Медина', en: 'Adhan · Madinah', tr: 'Ezan · Medine' },
    file: 'adhan_madinah',
    durationSec: 96,
  },
  {
    id: 'adhan_aqsa',
    kind: 'full',
    category: 'adhan',
    names: { bg: 'Езан · Ал-Акса', en: 'Adhan · Al-Aqsa', tr: 'Ezan · Mescid-i Aksa' },
    file: 'adhan_aqsa',
    durationSec: 225,
  },
  {
    id: 'adhan_istanbul',
    kind: 'full',
    category: 'adhan',
    names: { bg: 'Езан · Истанбул', en: 'Adhan · Istanbul', tr: 'Ezan · İstanbul' },
    file: 'adhan_istanbul',
    durationSec: 66,
  },
  // ---- кратки (iPhone и Android без точни аларми)
  {
    id: 'takbir_makkah',
    kind: 'short',
    category: 'takbir',
    names: { bg: 'Текбири · Мека', en: 'Takbir · Makkah', tr: 'Tekbir · Mekke' },
    file: 'takbir_makkah',
    ext: 'wav',
    durationSec: 30,
  },
  {
    id: 'takbir_madinah',
    kind: 'short',
    category: 'takbir',
    names: { bg: 'Текбири · Медина', en: 'Takbir · Madinah', tr: 'Tekbir · Medine' },
    file: 'takbir_madinah',
    ext: 'wav',
    durationSec: 25,
  },
  {
    id: 'takbir_aqsa',
    kind: 'short',
    category: 'takbir',
    names: { bg: 'Текбири · Ал-Акса', en: 'Takbir · Al-Aqsa', tr: 'Tekbir · Mescid-i Aksa' },
    file: 'takbir_aqsa',
    ext: 'wav',
    durationSec: 29,
  },
  {
    id: 'takbir_istanbul',
    kind: 'short',
    category: 'takbir',
    names: { bg: 'Текбири · Истанбул', en: 'Takbir · Istanbul', tr: 'Tekbir · İstanbul' },
    file: 'takbir_istanbul',
    ext: 'wav',
    durationSec: 30,
  },
  {
    id: 'chime',
    kind: 'short',
    category: 'chime',
    names: { bg: 'Сигнал', en: 'Signal', tr: 'Sinyal' },
    file: 'ezan_chime',
    ext: 'wav',
    durationSec: 2,
  },
  {
    id: 'chime_soft',
    kind: 'short',
    category: 'chime',
    names: { bg: 'Тих звън', en: 'Soft chime', tr: 'Yumuşak çan' },
    file: 'chime_soft',
    ext: 'wav',
    durationSec: 4,
  },
  {
    // звукът за известия, избран в настройките на телефона
    id: 'system',
    kind: 'short',
    category: 'chime',
    names: { bg: 'Звукът на телефона', en: "The phone's sound", tr: 'Telefonun sesi' },
    file: SYSTEM_SOUND,
    durationSec: 0,
  },
  // ---- още звуци за известията (assets/sounds/notify_*.wav, до 10 сек.)
  notifySound('airport', 'Летище', 'Airport', 'Havalimanı', 3),
  notifySound('popup', 'Изскачане', 'Pop-up', 'Açılır', 1),
  notifySound('right', 'Правилно', 'Right', 'Doğru', 1),
  notifySound('modern', 'Модерен', 'Modern', 'Modern', 2),
  notifySound('magical', 'Вълшебен', 'Magical', 'Büyülü', 4),
  notifySound('chime_bright', 'Звънче', 'Chime', 'Çan', 3),
  notifySound('doorbell', 'Звънец на врата', 'Doorbell', 'Kapı zili', 2),
  notifySound('celestial', 'Небесен', 'Celestial', 'Göksel', 5),
  notifySound('bell_ding', 'Камбанка', 'Bell ding', 'Küçük çan', 1),
  notifySound('crisp_ding', 'Чист звън', 'Crisp ding', 'Net çan', 6),
  notifySound('shimmer', 'Блясък', 'Shimmer', 'Parıltı', 6),
  notifySound('smoke_alarm', 'Аларма за дим', 'Smoke alarm', 'Duman alarmı', 1),
  notifySound('swoop', 'Полъх', 'Swoop', 'Esinti', 1),
  notifySound('retro', 'Ретро', 'Retro', 'Retro', 1),
  notifySound('robot', 'Робот', 'Robot', 'Robot', 2),
  notifySound('three_beep', 'Три сигнала', 'Three beeps', 'Üç bip', 1),
  notifySound('machine_beep', 'Машинен сигнал', 'Machine beep', 'Makine bip', 1),
  notifySound('water_drop', 'Капка', 'Water drop', 'Su damlası', 1),
  notifySound('hang_up', 'Затваряне', 'Hang up', 'Kapatma', 1),
  notifySound('standard', 'Стандартен', 'Standard', 'Standart', 5),
];

export const DEFAULT_FULL = 'adhan_makkah';
export const DEFAULT_SHORT = 'takbir_makkah';
/** Звукът на известията и напомнянията – по подразбиране звукът на телефона (решено 01.10.2026). */
export const DEFAULT_NOTIFY = 'system';

/** Молитвите, които имат аларма (изгревът е само известие). */
export const ALARM_PRAYERS: readonly PrayerId[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

/** Свой звук, добавен от потребителя. */
export interface CustomSound {
  id: string;
  kind: SoundKind;
  name: string;
  /** Android: file://… в паметта на приложението; iPhone: името на .caf файла в Library/Sounds. */
  file: string;
  /** Колко свири (на iPhone – след скъсяването до 30 сек.). */
  durationSec: number;
  /** iPhone: колко е бил записът, ако е скъсен. */
  originalSec?: number;
  /** 'notify' – свой звук за известия (до 10 сек.); иначе – за алармата. */
  use?: SoundUse;
}

export function customToDef(c: CustomSound): SoundDef {
  return {
    id: c.id,
    kind: c.kind,
    category: 'custom',
    names: { bg: c.name, en: c.name },
    file: c.file,
    ext: c.kind === 'short' ? 'caf' : undefined,
    durationSec: c.durationSec,
    originalSec: c.originalSec,
    custom: true,
    use: c.use ?? 'alarm',
  };
}

/** Всички звуци – вградените и своите. */
export function allSounds(custom: readonly CustomSound[]): SoundDef[] {
  return [...BUILTIN_SOUNDS, ...custom.map(customToDef)];
}

/** Звукът по id; ако го няма (изтрит свой звук) – резервният за вида. */
/**
 * За какво е звукът (решено 01.10.2026):
 * - 'alarm'  – звукът на молитвата с камбанка „аларма“ (пълен или кратък резервен): езан,
 *              текбири и своите звуци (мелодии – само свои, вградени няма);
 * - 'notify' – звукът на известията и напомнянията: само кратките сигнали (звън).
 */
export type SoundUse = 'alarm' | 'notify';

export function fitsUse(s: SoundDef, use: SoundUse): boolean {
  if (s.custom) return (s.use ?? 'alarm') === use;
  return use === 'notify' ? s.category === 'chime' : s.category !== 'chime';
}

/** Звукът по id; ако го няма (изтрит свой звук) или не е за това – резервният. */
export function findSound(
  id: string | undefined,
  kind: SoundKind,
  custom: readonly CustomSound[],
  use: SoundUse = 'alarm',
): SoundDef {
  const all = allSounds(custom);
  const found = all.find((s) => s.id === id && s.kind === kind && fitsUse(s, use));
  if (found) return found;
  const fallback = use === 'notify' ? DEFAULT_NOTIFY : kind === 'full' ? DEFAULT_FULL : DEFAULT_SHORT;
  return all.find((s) => s.id === fallback)!;
}

/** Името на файла за известие (expo-notifications): „takbir_makkah.wav“ / „custom_17.caf“. */
export function notificationFileName(s: SoundDef): string {
  if (s.id === 'system') return 'default'; // expo-notifications: звукът по подразбиране на телефона
  if (s.custom) return s.file; // на iPhone: името в Library/Sounds (с разширението)
  return `${s.file}.${s.ext ?? 'wav'}`;
}

/** „3:42“ */
export function formatDuration(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Проверка на своя звук преди добавяне. null – става; иначе причината. */
export function validateUpload(
  kind: SoundKind,
  durationSec: number,
  bytes: number | undefined,
  use: SoundUse = 'alarm',
): 'tooLong' | 'tooBig' | 'empty' | null {
  if (!(durationSec > 0.3)) return 'empty';
  if (bytes !== undefined && bytes > MAX_UPLOAD_BYTES) return 'tooBig';
  if (use === 'notify' && durationSec > NOTIFY_MAX_SEC + 0.5) return 'tooLong';
  if (kind === 'short' && durationSec > SHORT_MAX_SEC + 0.5) return 'tooLong';
  if (kind === 'full' && durationSec > FULL_MAX_SEC) return 'tooLong';
  return null;
}

/** Името от файла: „Ezan_Bania-Bashi.mp3“ → „Ezan Bania-Bashi“. */
export function nameFromFile(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').trim();
  return base.length > 40 ? `${base.slice(0, 39)}…` : base || 'Sound';
}
