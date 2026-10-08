import type { SkylineId } from '@/domain/skylines';
import type { WidgetEntry } from '@/domain/widget';

import { setWidgetData } from '../../modules/hayya-native';

/**
 * Android: кадрите отиват в native частта (modules/hayya-native – WidgetStore.kt), която
 * рисува widget-ите и ги обновява в часа на всяка молитва. skyline – силуетът в ъгъла на „Следваща“. iPhone – виж index.ios.ts.
 */
export function pushWidgetEntries(entries: WidgetEntry[], emptyText: string, skyline: SkylineId): void {
  setWidgetData(JSON.stringify({ v: 1, emptyText, entries, skyline }));
}
