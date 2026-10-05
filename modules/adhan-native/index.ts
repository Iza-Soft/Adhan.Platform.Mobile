import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

/**
 * Native функциите на Езан (само Android). На iPhone и в уеб модулът липсва –
 * тогава функциите връщат безопасни стойности (null / false).
 */
interface AdhanNativeModule {
  canScheduleExactAlarms(): boolean;
  openExactAlarmSettings(): void;
  // етап 5
  setAlarms?(json: string): number;
  getAlarms?(): string;
  getAlarmHistory?(): string;
  testAlarm?(json: string, delayMs: number): boolean;
  stopAlarm?(): void;
  canUseFullScreenIntent?(): boolean;
  openFullScreenIntentSettings?(): void;
  isIgnoringBatteryOptimizations?(): boolean;
  openAppSettings?(): void;
  openBatteryOptimizationSettings?(): void;
  hasGoogleServices?(): boolean;
  getCurrentLocation?(timeoutMs: number): Promise<NativeLocation | null>;
  // етап 6 – звуци
  previewSound?(source: string): void;
  stopPreview?(): void;
  getAudioDuration?(uri: string): Promise<number>;
  prepareShortSound?(uri: string, title: string, maxSec: number): Promise<PreparedShortSound>;
  deleteShortSound?(uri: string): void;
  createSoundChannel?(id: string, name: string, uri: string, alarm: boolean, vibrate: boolean, pattern: number[]): void;
  // етап 8 – widget-и
  setWidgetData?(json: string): void;
  getWidgetCount?(): number;
}

/** Android: свой кратък звук – откъсът в Notifications/Ezan. */
export interface PreparedShortSound {
  uri: string;
  duration: number;
  originalDuration: number;
  trimmed: boolean;
}

/** Резултатът от подготовката на свой звук на iPhone. */
export interface PreparedSound {
  /** Колко свири (след скъсяването), сек. */
  duration: number;
  /** Колко е бил записът, сек. */
  originalDuration: number;
  /** true – записът е скъсен до 30 сек. (на пауза, с плавно заглъхване). */
  trimmed: boolean;
  ok: boolean;
}

/** Функциите на iPhone (етап 6): своите звуци за известия. */
interface AdhanNativeIos {
  getAudioDuration(uri: string): Promise<number>;
  prepareNotificationSound(uri: string, name: string, maxSec: number): Promise<PreparedSound>;
  deleteNotificationSound(name: string): void;
  soundsDirectoryUri(): string;
}

export interface NativeLocation {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  timestamp: number;
  provider: string | null;
}

/** Една аларма за native частта (виж AlarmData.kt). */
export interface NativeAlarm {
  id: string;
  /** ms */
  at: number;
  prayer: string;
  /** „Време е за Магриб“ */
  title: string;
  arabic: string;
  place: string;
  notifTitle: string;
  notifBody: string;
  /** Градиентът на молитвата – 3 цвята „#RRGGBB“. */
  colors: [string, string, string];
  vibrate: boolean;
  /** Звукът в res/raw без разширение. */
  sound: string;
  lang: 'bg' | 'en';
  labels: {
    app: string;
    stop: string;
    mute: string;
    muteShort: string;
    close: string;
    soundName: string;
    channel: string;
  };
}

export interface AlarmHistoryItem {
  id: string;
  title: string;
  planned: number;
  fired: number;
}

const native = Platform.OS === 'android' ? requireOptionalNativeModule<AdhanNativeModule>('AdhanNative') : null;
const ios = Platform.OS === 'ios' ? requireOptionalNativeModule<AdhanNativeIos>('AdhanNative') : null;

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

/** null – неприложимо (iPhone, уеб) или модулът липсва (стар build без него). */
export function canScheduleExactAlarms(): boolean | null {
  if (!native) return null;
  return safe(() => native.canScheduleExactAlarms(), null);
}

export function openExactAlarmSettings(): void {
  safe(() => native?.openExactAlarmSettings(), undefined);
}

/* ------------------------------------------------------------------ алармата с езана */

/** Има ли native аларма (Android с build от етап 5). Иначе езанът е звукът на известието. */
export function hasNativeAlarms(): boolean {
  return !!native?.setAlarms;
}

/** Заменя всички аларми. Връща колко са планирани (−1 – няма native аларма). */
export function setAlarms(alarms: NativeAlarm[]): number {
  if (!native?.setAlarms) return -1;
  return safe(() => native.setAlarms!(JSON.stringify(alarms)), -1);
}

export function getAlarms(): NativeAlarm[] {
  if (!native?.getAlarms) return [];
  return safe(() => JSON.parse(native.getAlarms!()) as NativeAlarm[], []);
}

export function getAlarmHistory(): AlarmHistoryItem[] {
  if (!native?.getAlarmHistory) return [];
  return safe(() => JSON.parse(native.getAlarmHistory!()) as AlarmHistoryItem[], []);
}

export function testAlarm(alarm: NativeAlarm, delayMs: number): boolean {
  if (!native?.testAlarm) return false;
  return safe(() => native.testAlarm!(JSON.stringify(alarm), delayMs), false);
}

export function stopAlarm(): void {
  safe(() => native?.stopAlarm?.(), undefined);
}

/* ------------------------------------------------------------------ аларма на цял екран */

/** Android 14+: разрешено ли е „Аларма на цял екран“. null – неприложимо. */
export function canUseFullScreenIntent(): boolean | null {
  if (!native?.canUseFullScreenIntent) return null;
  return safe(() => native.canUseFullScreenIntent!(), null);
}

export function openFullScreenIntentSettings(): void {
  safe(() => native?.openFullScreenIntentSettings?.(), undefined);
}

/* ------------------------------------------------------------------ работа на заден план */

/** true – Езан работи без ограничения на батерията. null – неприложимо. */
export function isIgnoringBatteryOptimizations(): boolean | null {
  if (!native?.isIgnoringBatteryOptimizations) return null;
  return safe(() => native.isIgnoringBatteryOptimizations!(), null);
}

export function openAppSettings(): void {
  safe(() => native?.openAppSettings?.(), undefined);
}

export function openBatteryOptimizationSettings(): void {
  safe(() => native?.openBatteryOptimizationSettings?.(), undefined);
}

/* ------------------------------------------------------------------ местоположение без Google */

/** false – телефон без Google услуги (Huawei); null – неприложимо/неизвестно. */
export function hasGoogleServices(): boolean | null {
  if (!native?.hasGoogleServices) return null;
  return safe(() => native.hasGoogleServices!(), null);
}

/** Позицията от вградения в Android LocationManager (без Google). null – няма. */
export async function getNativeLocation(timeoutMs: number): Promise<NativeLocation | null> {
  if (!native?.getCurrentLocation) return null;
  try {
    return await native.getCurrentLocation(timeoutMs);
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ звуци (етап 6) */

/** Android: преслушване на вграден звук (res/raw) или свой файл. */
export function previewNativeSound(source: string): boolean {
  if (!native?.previewSound) return false;
  return safe(() => {
    native.previewSound!(source);
    return true;
  }, false);
}

export function stopNativePreview(): void {
  safe(() => native?.stopPreview?.(), undefined);
}

/** Дължината на звуков файл в секунди; −1 – не е звук; null – няма native модул. */
export async function getAudioDuration(uri: string): Promise<number | null> {
  try {
    if (native?.getAudioDuration) return await native.getAudioDuration(uri);
    if (ios) return await ios.getAudioDuration(uri);
  } catch {
    return -1;
  }
  return null;
}

/** iPhone: преобразува своя звук в Library/Sounds/<name> (.caf); по-дълъг от maxSec се скъсява. */
export async function prepareNotificationSound(
  uri: string,
  name: string,
  maxSec: number,
): Promise<PreparedSound | null> {
  if (!ios) return null;
  return ios.prepareNotificationSound(uri, name, maxSec);
}

export function deleteNotificationSound(name: string): void {
  safe(() => ios?.deleteNotificationSound(name), undefined);
}

/** iPhone: file://…/Library/Sounds/ – за преслушване на своите звуци. */
export function iosSoundsDirectoryUri(): string | null {
  if (!ios) return null;
  return safe(() => ios.soundsDirectoryUri(), null);
}

/** Android: откъс до maxSec от своя звук (срез на пауза, заглъхване) в Notifications/Ezan. */
export async function prepareShortSound(uri: string, title: string, maxSec: number): Promise<PreparedShortSound | null> {
  if (!native?.prepareShortSound) return null;
  return native.prepareShortSound(uri, title, maxSec);
}

export function deleteShortSound(uri: string): void {
  safe(() => native?.deleteShortSound?.(uri), undefined);
}

/** Android: канал за известие със свой звук. false – няма native модул. */
export function createSoundChannel(
  id: string,
  name: string,
  uri: string,
  alarm: boolean,
  vibrate: boolean,
  pattern: number[],
): boolean {
  if (!native?.createSoundChannel) return false;
  return safe(() => {
    native.createSoundChannel!(id, name, uri, alarm, vibrate, pattern);
    return true;
  }, false);
}

/* ------------------------------------------------------------------ widget-и (етап 8) */

/** Android: кадрите на widget-ите (виж src/domain/widget.ts). Без widget-и в build-а – нищо. */
export function setWidgetData(json: string): void {
  safe(() => native?.setWidgetData?.(json), undefined);
}

/** Android: колко widget-а на Езан има на началния екран (−1 – неизвестно). */
export function getWidgetCount(): number {
  if (!native?.getWidgetCount) return -1;
  return safe(() => native.getWidgetCount!(), -1);
}
