import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import {
  DEFAULT_HIGH_LAT_RULE,
  DEFAULT_LOCATION,
  DEFAULT_MADHAB,
  DEFAULT_METHOD,
} from '@/config/defaults';
import {
  methodForCountry,
  type AsrMadhab,
  type CalculationMethodId,
  type HighLatRuleId,
  type MethodChoice,
} from '@/domain/calc';
import type { AppLocation } from '@/domain/location';
import type { NavAppId } from '@/domain/navApps';
import { getPlace, PLACES_COUNT, placeToLocation } from '@/domain/places';
import { countryOf } from '@/domain/resolve';
import type { PrayerId } from '@/domain/prayers';
import type { TimesOptions } from '@/domain/times';

/** Граници на ръчните корекции. */
export const OFFSET_LIMIT = 15; // ±15 мин. за молитва
export const HIJRI_LIMIT = 2; // ±2 дни
/** Възможните напомняния преди молитвата (минути); 0 = без напомняне. */
export const REMINDER_CHOICES = [0, 5, 10, 15, 20, 30] as const;

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

  /** 'auto' – според държавата (виж methodForCountry). */
  method: MethodChoice;
  madhab: AsrMadhab;
  highLatRule: HighLatRuleId;
  offsets: Record<PrayerId, number>;
  hijriAdjust: number;
  /** Напомняне X минути преди молитвата; 0 = без. */
  reminderMinutes: number;
  /** Вибрация при известие (Android; на iPhone решава телефонът). */
  vibrate: boolean;
  /** С кое приложение се отваря „Упътване“ до джамия (етап 12). */
  navApp: NavAppId;
  /** Изборът е запомнен (листа „Отвори с…“ или Настройки → Навигация); false – питаме при „Упътване“. */
  navRemembered: boolean;

  setAutoLocation: (on: boolean) => void;
  setGpsLocation: (loc: AppLocation) => void;
  chooseLocation: (loc: AppLocation) => void;
  setMethod: (m: MethodChoice) => void;
  setMadhab: (m: AsrMadhab) => void;
  setHighLatRule: (r: HighLatRuleId) => void;
  changeOffset: (id: PrayerId, delta: number) => void;
  resetOffsets: () => void;
  changeHijriAdjust: (delta: number) => void;
  setReminderMinutes: (n: number) => void;
  setVibrate: (on: boolean) => void;
  /** Запомня приложението за навигация – остава и след затваряне на приложението и рестарт. */
  setNavApp: (id: NavAppId) => void;
  /** Забравя избора (избраното приложение е изтрито) – следващото „Упътване“ пак пита. */
  forgetNavApp: () => void;
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
      reminderMinutes: 0,
      vibrate: true,
      navApp: 'auto',
      navRemembered: false,

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
      setReminderMinutes: (reminderMinutes) => set({ reminderMinutes }),
      setVibrate: (vibrate) => set({ vibrate }),
      setNavApp: (navApp) => set({ navApp, navRemembered: true }),
      forgetNavApp: () => set({ navApp: 'auto', navRemembered: false }),
    }),
    {
      name: 'ezan.settings',
      // 2 (етап 5): методът по подразбиране е „Автоматично“ – старият „Диянет“ по подразбиране
      // става „Автоматично“ (за Турция и Европа пак е Диянет)
      // 3 (етап 10): турски език – запазените места в България получават и турското име
      version: 3,
      migrate: (persisted, version) => {
        const state = persisted as Partial<SettingsState>;
        if (version < 2 && state.method === 'Turkey') state.method = 'auto';
        if (version < 3) {
          state.manualLocation = withTurkishName(state.manualLocation);
          state.gpsLocation = withTurkishName(state.gpsLocation);
        }
        return state as SettingsState;
      },
      storage: createJSONStorage(() => AsyncStorage),
      // новите полета (reminderMinutes, vibrate, navApp, navRemembered) липсват в старите записи – тогава важат стойностите по подразбиране
      partialize: ({
        autoLocation,
        gpsLocation,
        manualLocation,
        method,
        madhab,
        highLatRule,
        offsets,
        hijriAdjust,
        reminderMinutes,
        vibrate,
        navApp,
        navRemembered,
      }) => ({
        reminderMinutes,
        vibrate,
        navApp,
        navRemembered,
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

type TimesParts = Pick<SettingsState, 'method' | 'madhab' | 'highLatRule' | 'offsets'> & { location: AppLocation };

/** Опциите за часовете и техният „отпечатък“ `key` – по него се решава кога да се преизчисли. */
export function buildTimesOptions({ location, method, madhab, highLatRule, offsets }: TimesParts): {
  options: TimesOptions;
  key: string;
} {
  const options: TimesOptions = { location, method: resolveMethod(method, location), madhab, highLatRule, offsets };
  const key = JSON.stringify([
    location.id,
    location.latitude,
    location.longitude,
    location.source,
    location.muftiShift,
    options.method,
    madhab,
    highLatRule,
    offsets,
  ]);
  return { options, key };
}

/** „Автоматично“ → методът за държавата на мястото; иначе избраният. */
export function resolveMethod(method: MethodChoice, location: AppLocation): CalculationMethodId {
  return method === 'auto' ? methodForCountry(countryOf(location)) : method;
}

/** Същото, направо от състоянието – без React (ползва се и от известията във фонов режим). */
export function selectTimesOptions(s: SettingsState): { options: TimesOptions; key: string } {
  return buildTimesOptions({ ...s, location: selectLocation(s) });
}

/** Място в България, запазено преди етап 10: наново от списъка – с турското име. */
function withTurkishName<T extends AppLocation | null | undefined>(loc: T): T {
  if (!loc || !loc.id.startsWith('bg-')) return loc;
  const index = Number(loc.id.slice(3));
  if (!Number.isInteger(index) || index < 0 || index >= PLACES_COUNT) return loc;
  try {
    const fresh = placeToLocation(getPlace(index));
    return fresh.names.bg === loc.names.bg ? ({ ...loc, names: fresh.names, detail: fresh.detail } as T) : loc;
  } catch {
    return loc;
  }
}
