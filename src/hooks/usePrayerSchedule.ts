import { useMemo } from 'react';

import { DEFAULT_LOCATION, DEFAULT_MADHAB, DEFAULT_METHOD } from '@/config/defaults';
import { computeThreeDays, getSchedule, type CalcOptions, type Schedule } from '@/domain/prayers';

const OPTIONS: CalcOptions = {
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
  const days = useMemo(() => computeThreeDays(now, OPTIONS), [dayKey]);

  return getSchedule(now, days);
}

export { OPTIONS as CALC_OPTIONS };
