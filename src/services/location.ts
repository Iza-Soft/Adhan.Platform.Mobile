import * as Location from 'expo-location';
import { create } from 'zustand';

import { nameFromAddress } from '@/domain/abroadName';
import { isInBulgaria } from '@/domain/places';
import { locationFromCoords, type PlaceName } from '@/domain/resolve';
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
 * Името на мястото извън България от телефона (изисква интернет): градът,
 * а под него районът и държавата (виж nameFromAddress). Без връзка – null.
 */
async function nameAbroad(latitude: number, longitude: number): Promise<PlaceName | null> {
  try {
    const [addr] = await withTimeout(Location.reverseGeocodeAsync({ latitude, longitude }), 8000);
    return nameFromAddress(addr);
  } catch {
    return null;
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

    // точност ~100 м стига, за да се различат съседни села; последната известна позиция – резерва
    const position = await withTimeout(
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      15000,
    ).catch(() => Location.getLastKnownPositionAsync());

    if (!position) {
      setStatus('unavailable');
      return;
    }

    const { latitude, longitude } = position.coords;
    const abroad = isInBulgaria(latitude, longitude) ? null : await nameAbroad(latitude, longitude);
    useSettings.getState().setGpsLocation(locationFromCoords(latitude, longitude, abroad));
    useLocationStatus.setState({ status: 'ok', lastFix: Date.now() });
  } catch {
    setStatus('unavailable');
  }
}
