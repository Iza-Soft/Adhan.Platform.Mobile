import type { SkylineId } from '@/domain/skylines';
import type { WidgetEntry } from '@/domain/widget';

import { prayerArabicWidget, prayerWidget, type PrayerWidgetProps } from './PrayerWidget';

/**
 * iPhone: кадрите стават timeline на WidgetKit – iOS сам сменя кадъра в часа на всяка
 * молитва и в полунощ. След последния кадър (ако приложението не се отваря 7 дни) –
 * „Отвори Hayya…“.
 */
// _skyline: widget-ите на iPhone нямат силует (на Android – ъгълът на „Следваща“)
export function pushWidgetEntries(entries: WidgetEntry[], emptyText: string, _skyline?: SkylineId): void {
  if (!entries.length) {
    const empty: PrayerWidgetProps = { empty: true, emptyText };
    prayerWidget.updateSnapshot(empty);
    prayerArabicWidget.updateSnapshot(empty);
    return;
  }
  const last = entries[entries.length - 1];
  const timeline: { date: Date; props: PrayerWidgetProps }[] = [
    ...entries.map((e) => ({ date: new Date(e.from), props: e })),
    { date: new Date(last.nextAt), props: { empty: true, emptyText } },
  ];
  prayerWidget.updateTimeline(timeline);
  prayerArabicWidget.updateTimeline(timeline);
}
