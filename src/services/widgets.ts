import { Platform } from 'react-native';

import { planWidget } from '@/domain/widget';
import { getI18n } from '@/i18n';
import { selectLocation, selectTimesOptions, useSettings } from '@/store/settings';
import { PHASE_GRADIENTS } from '@/theme/gradients';
import { pushWidgetEntries } from '@/widgets';

/**
 * Обновява widget-ите (етап 8): изчислява кадрите за следващите 7 дни и ги дава на
 * Android (native) или на iPhone (WidgetKit timeline).
 * Вика се при стартиране, при връщане в приложението, при промяна на настройките и от
 * фоновата задача. Ако нищо не се е променило – не прави нищо (кадрите са едни и същи
 * през целия интервал на една молитва, виж planWidget).
 */
let lastSignature = '';

export function updateWidgets(now: Date = new Date()): void {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') return;
  try {
    const s = useSettings.getState();
    const { t, pick } = getI18n();
    const entries = planWidget({
      now,
      options: selectTimesOptions(s).options,
      placeName: pick(selectLocation(s).names),
      texts: { prayers: t.prayers, ...t.hero, ...t.widget },
      gradients: PHASE_GRADIENTS,
    });
    const signature = JSON.stringify(entries);
    if (signature === lastSignature) return;
    pushWidgetEntries(entries, t.widget.empty);
    lastSignature = signature;
  } catch (e) {
    console.warn('[widgets]', e);
  }
}
