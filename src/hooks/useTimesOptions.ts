import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';

import type { TimesOptions } from '@/domain/times';
import { buildTimesOptions, selectLocation, useSettings } from '@/store/settings';

/**
 * Всичко, от което зависят часовете, събрано от настройките.
 * Ползва се от „Днес“ и „Месец“; известията ползват същото `buildTimesOptions`
 * (чрез `selectTimesOptions`), затова всички показват едни и същи часове.
 */
export function useTimesOptions(): { options: TimesOptions; key: string } {
  const { location, method, madhab, highLatRule, offsets } = useSettings(
    useShallow((s) => ({
      location: selectLocation(s),
      method: s.method,
      madhab: s.madhab,
      highLatRule: s.highLatRule,
      offsets: s.offsets,
    })),
  );
  return useMemo(
    () => buildTimesOptions({ location, method, madhab, highLatRule, offsets }),
    [location, method, madhab, highLatRule, offsets],
  );
}
