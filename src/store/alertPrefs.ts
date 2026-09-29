import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { PRAYERS, type PrayerId } from '@/domain/prayers';

/** Трите състояния на камбанката: сиво / бяло / злато. */
export type AlertMode = 'off' | 'notify' | 'adhan';

const DEFAULT_MODES: Record<PrayerId, AlertMode> = {
  fajr: 'adhan',
  sunrise: 'notify',
  dhuhr: 'notify',
  asr: 'adhan',
  maghrib: 'adhan',
  isha: 'notify',
};

/** off → notify → adhan → off. Изгрев прескача „езан“. */
export function nextMode(id: PrayerId, mode: AlertMode): AlertMode {
  if (mode === 'off') return 'notify';
  if (mode === 'notify') return PRAYERS[id].canAlarm ? 'adhan' : 'off';
  return 'off';
}

interface AlertPrefsState {
  modes: Record<PrayerId, AlertMode>;
  /** Сменя режима и връща новия (за toast-а). */
  cycle: (id: PrayerId) => AlertMode;
}

export const useAlertPrefs = create<AlertPrefsState>()(
  persist(
    (set, get) => ({
      modes: DEFAULT_MODES,
      cycle: (id) => {
        const mode = nextMode(id, get().modes[id]);
        set((s) => ({ modes: { ...s.modes, [id]: mode } }));
        return mode;
      },
    }),
    {
      name: 'ezan.alert-prefs',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ modes: s.modes }),
    },
  ),
);
