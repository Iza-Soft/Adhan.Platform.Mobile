import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

/**
 * Native функциите на Езан (само Android). На iPhone и в уеб модулът липсва –
 * тогава функциите връщат безопасни стойности.
 */
interface AdhanNativeModule {
  canScheduleExactAlarms(): boolean;
  openExactAlarmSettings(): void;
}

const native = Platform.OS === 'android' ? requireOptionalNativeModule<AdhanNativeModule>('AdhanNative') : null;

/** null – неприложимо (iPhone, уеб) или модулът липсва (стар build без него). */
export function canScheduleExactAlarms(): boolean | null {
  if (!native) return null;
  try {
    return native.canScheduleExactAlarms();
  } catch {
    return null;
  }
}

export function openExactAlarmSettings(): void {
  native?.openExactAlarmSettings();
}
