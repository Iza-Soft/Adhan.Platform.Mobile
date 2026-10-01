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
