import { useMemo } from 'react';

import { DEFAULT_LOCATION, DEFAULT_MADHAB, DEFAULT_METHOD } from '@/config/defaults';
import { getSchedule, type Schedule } from '@/domain/prayers';
import { computeThreeDays, type TimesOptions } from '@/domain/times';

/** Засега фиксирани; в етап 3 идват от настройките (град, метод, корекции). */
export const TIMES_OPTIONS: TimesOptions = {
  location: DEFAULT_LOCATION,
  method: DEFAULT_METHOD,
  madhab: DEFAULT_MADHAB,
};

/**
 * Часовете се преизчисляват само когато се смени денят,
 * а текущата/следващата молитва – на всяка секунда (евтино е).
 */
export function usePrayerSchedule(now: Date): Schedule {
  const dayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const days = useMemo(() => computeThreeDays(now, TIMES_OPTIONS), [dayKey]);

  return getSchedule(now, days);
}
