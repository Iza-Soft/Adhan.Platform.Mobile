import { Accelerometer, Magnetometer } from 'expo-sensors';
import * as Location from 'expo-location';
import { useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';

import {
  angleDelta,
  headingFromSensors,
  magneticInfo,
  normalizeDeg,
  qualityFromAccuracy,
  qualityFromField,
  smoothHeading,
  type CompassQuality,
} from '@/domain/qibla';

/**
 * Компасът на телефона.
 * - Android: акселерометър + магнитометър (expo-sensors). Не иска разрешения и не зависи
 *   от Google услуги – работи и на Huawei без GMS. Деклинацията е от World Magnetic Model.
 * - iPhone: компасът на iOS (CoreLocation през expo-location) – калибриран от системата,
 *   с точност в градуси. Изисква разрешение за местоположение.
 * Слуша сензорите само докато `active` е true (екранът „Кибла“ е отворен) – пести батерия.
 */

export type CompassStatus = 'starting' | 'ok' | 'unavailable' | 'needsPermission';

export interface CompassState {
  status: CompassStatus;
  /** Посока на горния край на телефона спрямо ИСТИНСКИЯ север, 0–360°. */
  heading: number | null;
  /**
   * Същата посока, но „непрекъсната“ (359° → 361°, не → 1°) – за плавно въртене
   * на компаса без завъртане наобратно през 0°.
   */
  rotation: number;
  quality: CompassQuality;
}

const INITIAL: CompassState = { status: 'starting', heading: null, rotation: 0, quality: 'high' };
const UPDATE_MS = 60;

export function useCompass(lat: number, lon: number, active: boolean): CompassState & { retry: () => void } {
  const [state, setState] = useState<CompassState>(INITIAL);
  const [attempt, setAttempt] = useState(0);

  // деклинацията и очакваното поле се сменят бавно – закръгляме мястото до ~10 км
  const latKey = Math.round(lat * 10) / 10;
  const lonKey = Math.round(lon * 10) / 10;
  const info = useMemo(() => magneticInfo(latKey, lonKey), [latKey, lonKey]);

  useEffect(() => {
    if (!active) return;
    let alive = true;
    let heading: number | null = null;
    let rotation = 0;
    let lastSent = 0;
    let lastQuality: CompassQuality = 'high';
    const cleanups: (() => void)[] = [];

    const publish = (next: number, quality: CompassQuality) => {
      const prev = heading;
      heading = next;
      rotation += prev === null ? next : angleDelta(prev, next);
      const now = Date.now();
      // React не трябва да се прерисува 16 пъти в секунда за промени под половин градус
      if (prev !== null && Math.abs(angleDelta(prev, next)) < 0.4 && quality === lastQuality && now - lastSent < 400) {
        return;
      }
      lastSent = now;
      lastQuality = quality;
      if (alive) setState({ status: 'ok', heading: next, rotation, quality });
    };

    (async () => {
      if (Platform.OS === 'android') {
        const [hasMag, hasAcc] = await Promise.all([Magnetometer.isAvailableAsync(), Accelerometer.isAvailableAsync()]);
        if (!alive) return;
        if (!hasMag || !hasAcc) {
          setState({ ...INITIAL, status: 'unavailable' });
          return;
        }
        let gravity: { x: number; y: number; z: number } | null = null;
        let field: { x: number; y: number; z: number } | null = null;
        let fieldRatio = 1;
        Accelerometer.setUpdateInterval(UPDATE_MS);
        Magnetometer.setUpdateInterval(UPDATE_MS);
        const acc = Accelerometer.addListener((a) => {
          // лек нискочестотен филтър: остава само гравитацията, без треперенето на ръката
          gravity = gravity
            ? { x: gravity.x * 0.8 + a.x * 0.2, y: gravity.y * 0.8 + a.y * 0.2, z: gravity.z * 0.8 + a.z * 0.2 }
            : a;
        });
        const mag = Magnetometer.addListener((m) => {
          field = field
            ? { x: field.x * 0.7 + m.x * 0.3, y: field.y * 0.7 + m.y * 0.3, z: field.z * 0.7 + m.z * 0.3 }
            : m;
          if (!gravity) return;
          const magnetic = headingFromSensors(gravity, field);
          if (magnetic === null) return;
          fieldRatio = fieldRatio * 0.9 + (Math.hypot(m.x, m.y, m.z) / info.fieldUT) * 0.1;
          const trueHeading = normalizeDeg(magnetic + info.declination);
          publish(smoothHeading(heading, trueHeading, 0.25), qualityFromField(fieldRatio * info.fieldUT, info.fieldUT));
        });
        cleanups.push(() => acc.remove(), () => mag.remove());
        return;
      }

      if (Platform.OS === 'ios') {
        const perm = await Location.getForegroundPermissionsAsync();
        if (!alive) return;
        if (perm.status !== 'granted') {
          setState({ ...INITIAL, status: 'needsPermission' });
          return;
        }
        try {
          const sub = await Location.watchHeadingAsync((h) => {
            const trueHeading = h.trueHeading >= 0 ? h.trueHeading : normalizeDeg(h.magHeading + info.declination);
            publish(smoothHeading(heading, trueHeading, 0.5), qualityFromAccuracy(h.accuracy));
          });
          if (!alive) sub.remove();
          else cleanups.push(() => sub.remove());
        } catch {
          if (alive) setState({ ...INITIAL, status: 'unavailable' });
        }
        return;
      }

      setState({ ...INITIAL, status: 'unavailable' }); // уеб
    })();

    return () => {
      alive = false;
      cleanups.forEach((c) => c());
    };
  }, [active, info, attempt]);

  return { ...state, retry: () => setAttempt((a) => a + 1) };
}
