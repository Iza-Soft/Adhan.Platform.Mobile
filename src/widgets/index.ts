import type { WidgetEntry } from '@/domain/widget';

import { setWidgetData } from '../../modules/adhan-native';

/**
 * Android: кадрите отиват в native частта (modules/adhan-native – WidgetStore.kt), която
 * рисува widget-ите и ги обновява в часа на всяка молитва. iPhone – виж index.ios.ts.
 */
export function pushWidgetEntries(entries: WidgetEntry[], emptyText: string): void {
  setWidgetData(JSON.stringify({ v: 1, emptyText, entries }));
}
