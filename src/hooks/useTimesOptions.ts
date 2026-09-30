import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';

import type { TimesOptions } from '@/domain/times';
import { selectLocation, useSettings } from '@/store/settings';

/**
 * Всичко, от което зависят часовете, събрано от настройките.
 * Ползва се от „Днес“, „Месец“ (и по-късно от нотификациите), затова всички
 * екрани винаги показват едни и същи часове.
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

  return useMemo(() => {
    const options: TimesOptions = { location, method, madhab, highLatRule, offsets };
    // „отпечатък“ на настройките – по него се преизчисляват часовете
    const key = JSON.stringify([
      location.id,
      location.latitude,
      location.longitude,
      location.source,
      location.muftiShift,
      method,
      madhab,
      highLatRule,
      offsets,
    ]);
    return { options, key };
  }, [location, method, madhab, highLatRule, offsets]);
}
