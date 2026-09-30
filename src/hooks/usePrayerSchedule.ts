import { useMemo } from 'react';

import { getSchedule, type Schedule } from '@/domain/prayers';
import { computeThreeDays } from '@/domain/times';

import { useTimesOptions } from './useTimesOptions';

/**
 * Часовете се преизчисляват само когато се смени денят или настройките
 * (място, метод, корекции), а текущата/следващата молитва – на всяка секунда (евтино е).
 */
export function usePrayerSchedule(now: Date): Schedule {
  const { options, key } = useTimesOptions();
  const dayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const days = useMemo(() => computeThreeDays(now, options), [dayKey, key]);

  return getSchedule(now, days);
}
