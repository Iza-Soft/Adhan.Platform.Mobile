import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useI18n } from '@/i18n';
import { colors } from '@/theme/colors';
import { fonts } from '@/theme/typography';

import { ChevronIcon } from './icons';

interface Props {
  title: string; // „Октомври 2026“
  hijriRange: string; // „Ребиул-ахир – Джемазиел-евел 1448“
  city: string;
  showToday: boolean;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}

/** Месец и година, стрелки за смяна, диапазон по Хиджра и бутон „Днес“. */
export function MonthHeader({ title, hijriRange, city, showToday, onPrev, onNext, onToday }: Props) {
  const { t } = useI18n();

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Pressable
          onPress={onPrev}
          hitSlop={8}
          style={({ pressed }) => [styles.arrow, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={t.month.prev}
        >
          <ChevronIcon direction="left" color={colors.text} />
        </Pressable>
        <View style={styles.titles}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.hijri}>{hijriRange}</Text>
        </View>
        <Pressable
          onPress={onNext}
          hitSlop={8}
          style={({ pressed }) => [styles.arrow, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={t.month.next}
        >
          <ChevronIcon direction="right" color={colors.text} />
        </Pressable>
      </View>
      <View style={styles.meta}>
        <Text style={styles.city}>{city}</Text>
        {showToday && (
          <Pressable
            onPress={onToday}
            style={({ pressed }) => [styles.todayBtn, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <Text style={styles.todayText}>{t.month.today}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 12, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  arrow: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.pill,
  },
  pressed: { opacity: 0.7 },
  titles: { flex: 1, alignItems: 'center' },
  title: { fontFamily: fonts.extrabold, fontSize: 22, color: colors.text },
  hijri: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.gold, textAlign: 'center' },
  meta: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    minHeight: 28,
  },
  city: { fontFamily: fonts.semibold, fontSize: 13, color: colors.muted },
  todayBtn: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.gold,
  },
  todayText: { fontFamily: fonts.bold, fontSize: 12, color: colors.gold },
});
