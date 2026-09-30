import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import {
  DEFAULT_HIGH_LAT_RULE,
  DEFAULT_LOCATION,
  DEFAULT_MADHAB,
  DEFAULT_METHOD,
} from '@/config/defaults';
import type { AsrMadhab, CalculationMethodId, HighLatRuleId } from '@/domain/calc';
import type { AppLocation } from '@/domain/location';
import type { PrayerId } from '@/domain/prayers';

/** Граници на ръчните корекции. */
export const OFFSET_LIMIT = 15; // ±15 мин. за молитва
export const HIJRI_LIMIT = 2; // ±2 дни

const NO_OFFSETS: Record<PrayerId, number> = {
  fajr: 0,
  sunrise: 0,
  dhuhr: 0,
  asr: 0,
  maghrib: 0,
  isha: 0,
};

const clamp = (v: number, limit: number) => Math.max(-limit, Math.min(limit, v));

interface SettingsState {
  /** true – мястото идва от GPS; false – избрано ръчно. */
  autoLocation: boolean;
  /** Последното място от GPS (пази се, за да работи веднага при следващо отваряне и без GPS). */
  gpsLocation: AppLocation | null;
  /** Ръчно избраното място. */
  manualLocation: AppLocation | null;

  method: CalculationMethodId;
  madhab: AsrMadhab;
  highLatRule: HighLatRuleId;
  offsets: Record<PrayerId, number>;
  hijriAdjust: number;

  setAutoLocation: (on: boolean) => void;
  setGpsLocation: (loc: AppLocation) => void;
  chooseLocation: (loc: AppLocation) => void;
  setMethod: (m: CalculationMethodId) => void;
  setMadhab: (m: AsrMadhab) => void;
  setHighLatRule: (r: HighLatRuleId) => void;
  changeOffset: (id: PrayerId, delta: number) => void;
  resetOffsets: () => void;
  changeHijriAdjust: (delta: number) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      autoLocation: true,
      gpsLocation: null,
      manualLocation: null,
      method: DEFAULT_METHOD,
      madhab: DEFAULT_MADHAB,
      highLatRule: DEFAULT_HIGH_LAT_RULE,
      offsets: NO_OFFSETS,
      hijriAdjust: 0,

      setAutoLocation: (on) => set({ autoLocation: on }),
      setGpsLocation: (loc) => set({ gpsLocation: loc }),
      // ръчният избор изключва GPS, за да не го „презапише“ следващото определяне
      chooseLocation: (loc) => set({ manualLocation: loc, autoLocation: false }),
      setMethod: (method) => set({ method }),
      setMadhab: (madhab) => set({ madhab }),
      setHighLatRule: (highLatRule) => set({ highLatRule }),
      changeOffset: (id, delta) =>
        set((s) => ({ offsets: { ...s.offsets, [id]: clamp(s.offsets[id] + delta, OFFSET_LIMIT) } })),
      resetOffsets: () => set({ offsets: NO_OFFSETS }),
      changeHijriAdjust: (delta) =>
        set((s) => ({ hijriAdjust: clamp(s.hijriAdjust + delta, HIJRI_LIMIT) })),
    }),
    {
      name: 'ezan.settings',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ autoLocation, gpsLocation, manualLocation, method, madhab, highLatRule, offsets, hijriAdjust }) => ({
        autoLocation,
        gpsLocation,
        manualLocation,
        method,
        madhab,
        highLatRule,
        offsets,
        hijriAdjust,
      }),
    },
  ),
);

/** Мястото, за което се показват часовете в момента. */
export function selectLocation(s: SettingsState): AppLocation {
  const chosen = s.autoLocation ? s.gpsLocation : s.manualLocation;
  return chosen ?? s.gpsLocation ?? DEFAULT_LOCATION;
}
