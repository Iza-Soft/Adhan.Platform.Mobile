import { StyleSheet, Text, View } from 'react-native';

import { formatHM } from '@/domain/format';
import { PRAYER_IDS } from '@/domain/prayers';
import type { MonthDay } from '@/domain/times';
import { useI18n } from '@/i18n';
import { colors } from '@/theme/colors';
import { FONT_SCALE, fonts, tabularNums } from '@/theme/typography';

export const MONTH_ROW_HEIGHT = 42;
/** Височината на разделителя за нов месец по Хиджра (26 + 2 × 2 отстъп). */
export const HIJRI_SEPARATOR_HEIGHT = 30;
const DAY_COL = 50;

/** Заглавният ред: „Ден / Хиджра“ и имената на молитвите. */
export function MonthColumns() {
  const { t } = useI18n();
  return (
    <View style={[styles.row, styles.headRow]}>
      <View style={styles.dayCol}>
        <Text maxFontSizeMultiplier={FONT_SCALE.dense} style={[styles.head, styles.headLeft]}>{t.month.dayColumn}</Text>
        <Text maxFontSizeMultiplier={FONT_SCALE.dense} style={styles.headHijri}>{t.month.hijriColumn}</Text>
      </View>
      {PRAYER_IDS.map((id) => (
        <Text maxFontSizeMultiplier={FONT_SCALE.dense} key={id} style={[styles.cell, styles.head]} numberOfLines={1} adjustsFontSizeToFit>
          {t.prayers[id]}
        </Text>
      ))}
    </View>
  );
}

/** Разделител на цялата ширина там, където започва нов месец по Хиджра: ─── Джемазиел-евел 1448 ─── */
export function HijriMonthSeparator({ label }: { label: string }) {
  return (
    <View style={styles.separator} accessibilityRole="header">
      <View style={styles.sepLine} />
      <Text maxFontSizeMultiplier={FONT_SCALE.dense} style={styles.sepText}>{label}</Text>
      <View style={styles.sepLine} />
    </View>
  );
}

interface RowProps {
  day: MonthDay;
  hijriDay: number;
  isToday: boolean;
}

/** Един ден: дата + ден от седмицата, ден по Хиджра и шестте часа. Петък е със златен ден от седмицата. */
export function MonthRow({ day, hijriDay, isToday }: RowProps) {
  const { t } = useI18n();
  const d = day.date;
  const isFriday = d.getDay() === 5;

  return (
    <View
      style={[styles.row, styles.dayRow, isToday && styles.today]}
      // за TalkBack/VoiceOver – целият ред наведнъж: „Пт 9 окт, петък: Фаджр 05:57, …“
      accessible
      accessibilityLabel={`${t.date.weekdaysShort[d.getDay()]} ${d.getDate()} ${t.date.monthsShort[d.getMonth()]}${
        isFriday ? `, ${t.month.friday}` : ''
      }${isToday ? `, ${t.month.today}` : ''}: ${day.times.map((p) => `${t.prayers[p.id]} ${formatHM(p.time)}`).join(', ')}`}
    >
      <View style={styles.dayCol}>
        <View style={styles.dateLine}>
          <Text maxFontSizeMultiplier={FONT_SCALE.dense} style={[styles.dateNum, isToday && styles.gold]}>{d.getDate()}</Text>
          <Text maxFontSizeMultiplier={FONT_SCALE.dense} style={[styles.weekday, isFriday && styles.gold]}>{t.date.weekdaysShort[d.getDay()]}</Text>
        </View>
        <Text maxFontSizeMultiplier={FONT_SCALE.dense} style={styles.hijriDay}>{hijriDay}</Text>
      </View>
      {day.times.map((p) => (
        <Text maxFontSizeMultiplier={FONT_SCALE.dense} key={p.id} style={[styles.cell, styles.time, isToday && styles.timeToday]}>
          {formatHM(p.time)}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 },
  headRow: {
    height: 36,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.14)',
  },
  head: {
    fontFamily: fonts.bold,
    fontSize: 10.5,
    letterSpacing: 0.3,
    color: colors.muted,
    textAlign: 'center',
  },
  headLeft: { textAlign: 'left' },
  headHijri: { fontFamily: fonts.semibold, fontSize: 9, color: 'rgba(212,168,87,0.8)' },
  separator: {
    height: HIJRI_SEPARATOR_HEIGHT - 4,
    marginVertical: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
  },
  sepLine: { flex: 1, height: 1, backgroundColor: 'rgba(212,168,87,0.45)' },
  sepText: { fontFamily: fonts.extrabold, fontSize: 11, letterSpacing: 0.3, color: colors.gold },
  dayRow: { height: MONTH_ROW_HEIGHT, borderRadius: 12 },
  today: {
    backgroundColor: colors.nowRow,
    borderWidth: 1,
    borderColor: colors.nowRowBorder,
  },
  dayCol: { width: DAY_COL },
  dateLine: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  dateNum: { fontFamily: fonts.extrabold, fontSize: 14, color: colors.text, ...tabularNums },
  weekday: { fontFamily: fonts.semibold, fontSize: 10.5, color: colors.muted },
  hijriDay: { fontFamily: fonts.medium, fontSize: 10, color: 'rgba(212,168,87,0.75)', ...tabularNums },
  gold: { color: colors.gold },
  cell: { flex: 1, textAlign: 'center' },
  time: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text, ...tabularNums },
  timeToday: { fontFamily: fonts.extrabold, color: colors.gold },
});
