import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useTabBarHeight } from '@/components/TabBar';
import { daysUntil, HOLIDAYS, holidaysInYear, nextHoliday, type Holiday } from '@/domain/holidays';
import { localEpochDay } from '@/domain/hijriTable';
import { useNow } from '@/hooks/useNow';
import { useI18n } from '@/i18n';
import { selectHolidaySource, useSettings } from '@/store/settings';
import { colors } from '@/theme/colors';
import { FONT_SCALE, fonts, tabularNums } from '@/theme/typography';

import { ChevronIcon } from '../icons';

import { HolidaySheet } from './HolidaySheet';
import { dayTile, hijriLine } from './holidayFormat';

/**
 * „Месец → Празници“ (етап 13): годината по Григорианския календар (по Хиджра отдолу),
 * следващият празник и всички празници по месеци. Докосване – подробности и напомняне.
 */
export function HolidaysView() {
  const tabBarHeight = useTabBarHeight();
  const { t } = useI18n();
  const h = t.holidays;
  const now = useNow(60_000);
  const source = useSettings(selectHolidaySource);
  const [year, setYear] = useState(now.getFullYear());
  const [open, setOpen] = useState<Holiday | null>(null);

  const list = holidaysInYear(source, year);
  const next = nextHoliday(source, now);
  const today = localEpochDay(now);
  const isNext = (x: Holiday) => !!next && next.id === x.id && next.date.getTime() === x.date.getTime();

  // по месеци
  const months: { month: number; items: Holiday[] }[] = [];
  for (const x of list) {
    const m = x.date.getMonth();
    if (months.at(-1)?.month !== m) months.push({ month: m, items: [] });
    months.at(-1)!.items.push(x);
  }

  const hijriFirst = list[0]?.hijri.year;
  const hijriLast = list.at(-1)?.hijri.year;

  return (
    <View style={styles.root}>
      <View style={styles.yearRow}>
        <Pressable
          onPress={() => setYear((y) => y - 1)}
          accessibilityRole="button"
          accessibilityLabel={h.prevYear}
          hitSlop={6}
          style={({ pressed }) => [styles.arrow, pressed && styles.pressed]}
        >
          <ChevronIcon direction="left" size={18} color={colors.text} />
        </Pressable>
        <View style={styles.yearText}>
          <Text style={styles.year} accessibilityRole="header">
            {year}
          </Text>
          {hijriFirst && hijriLast ? (
            <Text maxFontSizeMultiplier={FONT_SCALE.row} style={styles.hijriYears}>
              {h.hijriYears(hijriFirst, hijriLast)}
            </Text>
          ) : null}
        </View>
        <Pressable
          onPress={() => setYear((y) => y + 1)}
          accessibilityRole="button"
          accessibilityLabel={h.nextYear}
          hitSlop={6}
          style={({ pressed }) => [styles.arrow, pressed && styles.pressed]}
        >
          <ChevronIcon direction="right" size={18} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView
        style={{ marginBottom: tabBarHeight }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {next && year === now.getFullYear() && (
          <Pressable onPress={() => setOpen(next)} accessibilityRole="button" style={({ pressed }) => [styles.next, pressed && styles.pressed]}>
            <View style={styles.nextText}>
              <Text style={styles.nextLabel}>{h.next.toUpperCase()}</Text>
              <Text style={styles.nextName}>{h.names[next.id]}</Text>
              <Text style={styles.nextSub}>{hijriLine(next, t, true)}</Text>
            </View>
            {daysUntil(next, now) > 1 ? (
              <View style={styles.nextCount}>
                <Text style={styles.nextNum}>{daysUntil(next, now)}</Text>
                <Text style={styles.nextDays}>{h.daysWord(daysUntil(next, now))}</Text>
              </View>
            ) : (
              <Text style={styles.nextSoon}>{h.inDays(Math.max(0, daysUntil(next, now)))}</Text>
            )}
          </Pressable>
        )}

        {list.length === 0 && <Text style={styles.empty}>{h.noData}</Text>}

        {months.map(({ month, items }) => (
          <View key={month}>
            <Text style={styles.monthLabel}>{t.date.monthsFull[month].toUpperCase()}</Text>
            <View style={styles.card}>
              {items.map((x, i) => {
                const tile = dayTile(x, t);
                const past = localEpochDay(x.end) < today;
                const highlight = isNext(x);
                return (
                  <Pressable
                    key={`${x.id}-${x.date.getTime()}`}
                    onPress={() => setOpen(x)}
                    accessibilityRole="button"
                    accessibilityLabel={h.a11yRow(h.names[x.id], `${tile.wd} ${tile.day}`, hijriLine(x, t, false))}
                    style={({ pressed }) => [
                      styles.row,
                      i > 0 && styles.rowBorder,
                      past && styles.past,
                      highlight && styles.rowNext,
                      pressed && styles.pressed,
                    ]}
                  >
                    <View style={styles.tile}>
                      <Text style={[styles.tileDay, tile.day.includes('–') && styles.tileRange, x.expected && styles.expectedText]} numberOfLines={1}>
                        {x.expected ? `≈ ${tile.day}` : tile.day}
                      </Text>
                      <Text style={styles.tileWd}>{tile.wd}</Text>
                    </View>
                    <View style={styles.rowText}>
                      <View style={styles.nameLine}>
                        <Text style={styles.name}>{h.names[x.id]}</Text>
                        <Text style={styles.arabic} importantForAccessibility="no" accessibilityElementsHidden>
                          {HOLIDAYS[x.id].arabic}
                        </Text>
                      </View>
                      <Text style={styles.sub}>{hijriLine(x, t, false)}</Text>
                    </View>
                    {x.expected ? (
                      <Text style={styles.badge}>{h.expected}</Text>
                    ) : highlight ? (
                      <Text style={styles.badgeNext}>{h.inDays(Math.max(0, daysUntil(x, now)))}</Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}

        <Text style={styles.source}>{h.source[source]}</Text>
      </ScrollView>

      {open && <HolidaySheet holiday={open} source={source} onClose={() => setOpen(null)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  pressed: { opacity: 0.7 },
  yearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 4,
  },
  arrow: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  yearText: { alignItems: 'center' },
  year: { fontFamily: fonts.extrabold, fontSize: 26, color: colors.text, ...tabularNums },
  hijriYears: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.gold, ...tabularNums },
  content: { paddingHorizontal: 16, paddingBottom: 18 },
  next: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: 'rgba(212,168,87,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(212,168,87,0.55)',
  },
  nextText: { flex: 1, minWidth: 0 },
  nextLabel: { fontFamily: fonts.extrabold, fontSize: 11, letterSpacing: 1.1, color: colors.gold },
  nextName: { fontFamily: fonts.extrabold, fontSize: 18, color: colors.text, marginTop: 2 },
  nextSub: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.textDim, marginTop: 2, ...tabularNums },
  nextCount: { alignItems: 'flex-end' },
  nextNum: { fontFamily: fonts.extrabold, fontSize: 26, lineHeight: 30, color: colors.gold, ...tabularNums },
  nextDays: { fontFamily: fonts.bold, fontSize: 11.5, color: colors.gold },
  nextSoon: { fontFamily: fonts.extrabold, fontSize: 15, color: colors.gold },
  empty: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.muted, textAlign: 'center', marginTop: 30 },
  monthLabel: { fontFamily: fonts.extrabold, fontSize: 11, letterSpacing: 1.1, color: colors.muted, paddingTop: 14, paddingBottom: 6, paddingHorizontal: 4 },
  card: { borderRadius: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 56, paddingVertical: 8, paddingLeft: 6, paddingRight: 12 },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.10)' },
  rowNext: { backgroundColor: 'rgba(212,168,87,0.14)' },
  past: { opacity: 0.5 },
  tile: { width: 58, alignItems: 'center' },
  tileDay: { fontFamily: fonts.extrabold, fontSize: 17, lineHeight: 21, color: colors.text, ...tabularNums },
  tileRange: { fontSize: 14 },
  tileWd: { fontFamily: fonts.bold, fontSize: 10.5, color: colors.muted },
  expectedText: { color: colors.warn, fontSize: 13.5 },
  rowText: { flex: 1, minWidth: 0 },
  nameLine: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', columnGap: 8 },
  name: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.text },
  arabic: { fontFamily: fonts.arabic, fontSize: 15, color: colors.gold },
  sub: { fontFamily: fonts.regular, fontSize: 11.5, color: colors.muted, marginTop: 1, ...tabularNums },
  badge: {
    fontFamily: fonts.extrabold,
    fontSize: 10.5,
    color: colors.warn,
    borderWidth: 1,
    borderColor: 'rgba(227,154,75,0.6)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    overflow: 'hidden',
  },
  badgeNext: {
    fontFamily: fonts.extrabold,
    fontSize: 11.5,
    color: colors.goldInk,
    backgroundColor: colors.gold,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  source: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted, textAlign: 'center', marginTop: 16, paddingHorizontal: 12 },
});
