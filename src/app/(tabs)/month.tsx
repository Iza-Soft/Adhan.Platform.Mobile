import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GeometricPattern } from '@/components/GeometricPattern';
import {
  HIJRI_SEPARATOR_HEIGHT,
  HijriMonthSeparator,
  MONTH_ROW_HEIGHT,
  MonthColumns,
  MonthRow,
} from '@/components/MonthTable';
import { MonthHeader } from '@/components/MonthHeader';
import { useTabBarHeight } from '@/components/TabBar';
import { toHijri } from '@/domain/hijri';
import { computeMonth } from '@/domain/times';
import { useNow } from '@/hooks/useNow';
import { TIMES_OPTIONS } from '@/hooks/usePrayerSchedule';
import { useI18n } from '@/i18n';
import { colors } from '@/theme/colors';
import { fonts } from '@/theme/typography';

export default function MonthScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useTabBarHeight();
  const { lang, t } = useI18n();
  const now = useNow(60_000); // тук е достатъчно веднъж в минута

  const [ym, setYm] = useState(() => ({ y: now.getFullYear(), m: now.getMonth() }));
  const shiftMonth = (delta: number) =>
    setYm(({ y, m }) => {
      const d = new Date(y, m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });

  const days = useMemo(() => computeMonth(ym.y, ym.m, TIMES_OPTIONS), [ym.y, ym.m]);
  const hijri = useMemo(() => days.map((d) => toHijri(d.date)), [days]);

  const isCurrentMonth = ym.y === now.getFullYear() && ym.m === now.getMonth();
  const todayIndex = isCurrentMonth ? now.getDate() - 1 : -1;

  // „Ребиул-ахир – Джемазиел-евел 1448“ (или две години, ако месецът ги пресича)
  const first = hijri[0];
  const last = hijri[hijri.length - 1];
  const hijriRange =
    first.month === last.month
      ? `${t.hijriMonths[first.month - 1]} ${first.year}`
      : first.year === last.year
        ? `${t.hijriMonths[first.month - 1]} – ${t.hijriMonths[last.month - 1]} ${last.year}`
        : `${t.hijriMonths[first.month - 1]} ${first.year} – ${t.hijriMonths[last.month - 1]} ${last.year}`;

  // При отваряне на текущия месец превърта така, че днешният ден да се вижда
  // (с 3 реда над него). Разделителите за нов месец по Хиджра също заемат място.
  const scrollRef = useRef<ScrollView>(null);
  useEffect(() => {
    const target = todayIndex - 3;
    let y = 0;
    for (let i = 0; i < target; i++) {
      y += MONTH_ROW_HEIGHT + (hijri[i].day === 1 ? HIJRI_SEPARATOR_HEIGHT : 0);
    }
    scrollRef.current?.scrollTo({ y, animated: false });
  }, [ym.y, ym.m, todayIndex, hijri]);

  const location = TIMES_OPTIONS.location;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <GeometricPattern />
      <MonthHeader
        title={`${t.date.monthsFull[ym.m]} ${ym.y}`}
        hijriRange={hijriRange}
        city={location.names[lang]}
        showToday={!isCurrentMonth}
        onPrev={() => shiftMonth(-1)}
        onNext={() => shiftMonth(1)}
        onToday={() => setYm({ y: now.getFullYear(), m: now.getMonth() })}
      />
      {/* Картата свършва над долната навигация, за да не се застъпват редовете с нея. */}
      <View style={[styles.card, { marginBottom: tabBarHeight }]}>
        <MonthColumns />
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
        >
          {days.map((day, i) => (
            <Fragment key={i}>
              {hijri[i].day === 1 && (
                <HijriMonthSeparator label={`${t.hijriMonths[hijri[i].month - 1]} ${hijri[i].year}`} />
              )}
              <MonthRow day={day} hijriDay={hijri[i].day} isToday={i === todayIndex} />
            </Fragment>
          ))}
          <Text style={styles.source}>
            {location.source === 'mufti' ? t.month.sourceMufti : t.month.sourceCalc}
          </Text>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.base },
  card: {
    flex: 1,
    marginHorizontal: 10,
    paddingHorizontal: 2,
    paddingTop: 4,
    borderRadius: 22,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
  },
  list: { paddingBottom: 14 },
  source: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 14,
    paddingHorizontal: 16,
  },
});
