import { Fragment, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
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
import { useTimesOptions } from '@/hooks/useTimesOptions';
import { useI18n } from '@/i18n';
import { useSettings } from '@/store/settings';
import { colors } from '@/theme/colors';
import { fonts } from '@/theme/typography';

export default function MonthScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useTabBarHeight();
  const { t, pick } = useI18n();
  const now = useNow(60_000); // тук е достатъчно веднъж в минута

  const [ym, setYm] = useState(() => ({ y: now.getFullYear(), m: now.getMonth() }));
  const shiftMonth = (delta: number) =>
    setYm(({ y, m }) => {
      const d = new Date(y, m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });

  const { options, key } = useTimesOptions();
  const hijriAdjust = useSettings((s) => s.hijriAdjust);

  // Заглавието и бутоните реагират веднага, а таблицата се смята „на заден план“:
  // useDeferredValue първо рисува екрана със старата таблица (или с индикатор при първо
  // отваряне), после изчислява новия месец. Така смяната на месеца не „замръзва“.
  const request = useMemo(() => ({ y: ym.y, m: ym.m, key, hijriAdjust }), [ym.y, ym.m, key, hijriAdjust]);
  const shown = useDeferredValue(request, null);
  const pending = shown !== request;
  const table = useMemo(() => {
    if (!shown) return null;
    const days = computeMonth(shown.y, shown.m, options);
    return { days, hijri: days.map((d) => toHijri(d.date, shown.hijriAdjust)) };
    // options се сменя заедно с key
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown]);

  const isCurrentMonth = ym.y === now.getFullYear() && ym.m === now.getMonth();
  const shownIsCurrent = !!shown && shown.y === now.getFullYear() && shown.m === now.getMonth();
  const todayIndex = shownIsCurrent ? now.getDate() - 1 : -1;

  // „Ребиул-ахир – Джемазиел-евел 1448“ (или две години, ако месецът ги пресича) –
  // смята се само за първия и последния ден, за да е веднага в заглавието
  const first = toHijri(new Date(ym.y, ym.m, 1), hijriAdjust);
  const last = toHijri(new Date(ym.y, ym.m + 1, 0), hijriAdjust);
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
    if (!table) return;
    const target = todayIndex - 3;
    let y = 0;
    for (let i = 0; i < target; i++) {
      y += MONTH_ROW_HEIGHT + (table.hijri[i].day === 1 ? HIJRI_SEPARATOR_HEIGHT : 0);
    }
    scrollRef.current?.scrollTo({ y, animated: false });
  }, [table, todayIndex]);

  const location = options.location;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <GeometricPattern />
      <MonthHeader
        title={`${t.date.monthsFull[ym.m]} ${ym.y}`}
        hijriRange={hijriRange}
        city={pick(location.names)}
        showToday={!isCurrentMonth}
        onPrev={() => shiftMonth(-1)}
        onNext={() => shiftMonth(1)}
        onToday={() => setYm({ y: now.getFullYear(), m: now.getMonth() })}
      />
      {/* Картата свършва над долната навигация, за да не се застъпват редовете с нея. */}
      <View style={[styles.card, { marginBottom: tabBarHeight }]}>
        <MonthColumns />
        {table ? (
          <ScrollView
            ref={scrollRef}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.list}
            style={pending && styles.stale}
          >
            {table.days.map((day, i) => (
              <Fragment key={i}>
                {table.hijri[i].day === 1 && (
                  <HijriMonthSeparator
                    label={`${t.hijriMonths[table.hijri[i].month - 1]} ${table.hijri[i].year}`}
                  />
                )}
                <MonthRow day={day} hijriDay={table.hijri[i].day} isToday={i === todayIndex} />
              </Fragment>
            ))}
            <Text style={styles.source}>
              {location.source === 'mufti' ? t.month.sourceMufti : t.month.sourceCalc(t.methods[options.method])}
            </Text>
          </ScrollView>
        ) : null}
        {(pending || !table) && (
          <View style={styles.busy} pointerEvents="none">
            <ActivityIndicator size="large" color={colors.gold} accessibilityLabel={t.busy} />
          </View>
        )}
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
  stale: { opacity: 0.4 },
  busy: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  source: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 14,
    paddingHorizontal: 16,
  },
});
