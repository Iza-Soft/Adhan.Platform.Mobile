import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { PrayerId } from '@/domain/prayers';
import {
  ALARM_PRAYERS,
  DEFAULT_FULL,
  DEFAULT_NOTIFY,
  DEFAULT_SHORT,
  type CustomSound,
  type SoundKind,
} from '@/domain/sounds';

/** Избраните звуци за всяка молитва и своите звуци на потребителя. */
type PerPrayer = Partial<Record<PrayerId, string>>;

interface SoundsState {
  /** Пълният звук на алармата (Android). */
  full: PerPrayer;
  /** Краткият звук (iPhone; Android без точни аларми). */
  short: PerPrayer;
  /** Звукът на известията и напомнянията. */
  notify: string;
  custom: CustomSound[];

  setSound: (kind: SoundKind, prayer: PrayerId, id: string) => void;
  /** Звуците на тази молитва – за всички молитви. */
  applyToAll: (prayer: PrayerId) => void;
  setNotify: (id: string) => void;
  addCustom: (s: CustomSound) => void;
  /** Маха своя звук; молитвите с него се връщат към звука по подразбиране. */
  removeCustom: (id: string) => void;
}

const all = (id: string): PerPrayer => Object.fromEntries(ALARM_PRAYERS.map((p) => [p, id]));

export const useSounds = create<SoundsState>()(
  persist(
    (set) => ({
      full: all(DEFAULT_FULL),
      short: all(DEFAULT_SHORT),
      notify: DEFAULT_NOTIFY,
      custom: [],

      setSound: (kind, prayer, id) => set((s) => ({ [kind]: { ...s[kind], [prayer]: id } }) as Partial<SoundsState>),
      applyToAll: (prayer) =>
        set((s) => ({
          full: all(s.full[prayer] ?? DEFAULT_FULL),
          short: all(s.short[prayer] ?? DEFAULT_SHORT),
        })),
      setNotify: (notify) => set({ notify }),
      addCustom: (c) => set((s) => ({ custom: [...s.custom, c] })),
      removeCustom: (id) =>
        set((s) => {
          const reset = (m: PerPrayer, def: string): PerPrayer =>
            Object.fromEntries(Object.entries(m).map(([k, v]) => [k, v === id ? def : v]));
          return {
            custom: s.custom.filter((c) => c.id !== id),
            full: reset(s.full, DEFAULT_FULL),
            short: reset(s.short, DEFAULT_SHORT),
            notify: s.notify === id ? DEFAULT_NOTIFY : s.notify,
          };
        }),
    }),
    {
      name: 'ezan.sounds',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      // v1 (01.10.2026): звукът на известията по подразбиране е звукът на телефона, а не „Сигнал“
      migrate: (persisted, version) => {
        const st = persisted as Partial<SoundsState>;
        if (version < 1 && st.notify === 'chime') st.notify = DEFAULT_NOTIFY;
        return st as SoundsState;
      },
      partialize: ({ full, short, notify, custom }) => ({ full, short, notify, custom }),
    },
  ),
);
