import * as Location from 'expo-location';
import { Platform } from 'react-native';
import { create } from 'zustand';

import { getNativeLocation, hasGoogleServices } from '../../modules/hayya-native';

import { nameFromAddress } from '@/domain/abroadName';
import { isInBulgaria } from '@/domain/places';
import { locationFromCoords, type PlaceName } from '@/domain/resolve';
import { offlinePlaceName } from '@/domain/worldCities';
import { useSettings } from '@/store/settings';

/**
 * Определяне на мястото с GPS. Само докато приложението е отворено –
 * без фонов достъп до местоположението.
 */
export type LocationStatus = 'idle' | 'locating' | 'ok' | 'denied' | 'unavailable';

export const useLocationStatus = create<{ status: LocationStatus; lastFix: number }>(() => ({
  status: 'idle',
  lastFix: 0,
}));

const setStatus = (status: LocationStatus) => useLocationStatus.setState({ status });

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

/**
 * Името на мястото извън България: от телефона (изисква интернет) – градът, а под него
 * районът и държавата (виж nameFromAddress). Без връзка или без Google услуги (Huawei) –
 * от офлайн списъка на градовете: „Istanbul“ / „Турция“.
 */
async function nameAbroad(
  latitude: number,
  longitude: number,
): Promise<{ name: PlaceName | null; country: string | null }> {
  try {
    const [addr] = await withTimeout(Location.reverseGeocodeAsync({ latitude, longitude }), 8000);
    const name = nameFromAddress(addr);
    if (name) return { name, country: addr?.isoCountryCode ?? null };
  } catch {
    // без интернет / без геокодер – офлайн
  }
  return { name: offlinePlaceName(latitude, longitude), country: null };
}

/**
 * Позицията: през Google Play Services (expo-location), а на телефони без тях (Huawei) –
 * от вградения в Android LocationManager. Ако expo-location не успее, и на други Android
 * телефони се пробва LocationManager. Накрая – последната известна позиция.
 */
async function getPosition(): Promise<{ latitude: number; longitude: number } | null> {
  if (Platform.OS === 'android' && hasGoogleServices() === false) {
    const native = await getNativeLocation(15000);
    return native ? { latitude: native.latitude, longitude: native.longitude } : null;
  }
  try {
    const p = await withTimeout(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }), 15000);
    return p.coords;
  } catch {
    if (Platform.OS === 'android') {
      const native = await getNativeLocation(10000);
      if (native) return { latitude: native.latitude, longitude: native.longitude };
    }
    const last = await Location.getLastKnownPositionAsync().catch(() => null);
    return last?.coords ?? null;
  }
}

/**
 * Точната позиция сега – за „Джамии наблизо“ (етап 12). Пита за разрешение, ако още не е питано.
 * Не променя избраното място за часовете.
 */
export async function currentPosition(): Promise<
  { ok: true; latitude: number; longitude: number } | { ok: false; reason: 'denied' | 'unavailable' }
> {
  try {
    let perm = await Location.getForegroundPermissionsAsync();
    if (perm.status !== 'granted' && perm.canAskAgain) perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== 'granted') return { ok: false, reason: 'denied' };
    const p = await getPosition();
    return p ? { ok: true, latitude: p.latitude, longitude: p.longitude } : { ok: false, reason: 'unavailable' };
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
}

let running: Promise<void> | null = null;

/** Взима текущото местоположение и го записва като мястото от GPS. Паралелни извиквания се обединяват. */
export function refreshLocation(): Promise<void> {
  if (!running) {
    running = doRefresh().finally(() => {
      running = null;
    });
  }
  return running;
}

async function doRefresh(): Promise<void> {
  setStatus('locating');
  try {
    let perm = await Location.getForegroundPermissionsAsync();
    if (perm.status !== 'granted' && perm.canAskAgain) {
      perm = await Location.requestForegroundPermissionsAsync();
    }
    if (perm.status !== 'granted') {
      setStatus('denied');
      return;
    }

    // точност ~100 м стига, за да се различат съседни села
    const position = await getPosition();
    if (!position) {
      setStatus('unavailable');
      return;
    }

    const { latitude, longitude } = position;
    const abroad = isInBulgaria(latitude, longitude) ? null : await nameAbroad(latitude, longitude);
    useSettings.getState().setGpsLocation(locationFromCoords(latitude, longitude, abroad?.name, abroad?.country));
    useLocationStatus.setState({ status: 'ok', lastFix: Date.now() });
  } catch {
    setStatus('unavailable');
  }
}
