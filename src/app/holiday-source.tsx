import { router } from 'expo-router';
import { useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GeometricPattern } from '@/components/GeometricPattern';
import { ChevronIcon } from '@/components/icons';
import { resolveHolidaySource, type HolidaySourceChoice } from '@/domain/holidays';
import { countryOf } from '@/domain/resolve';
import { useI18n } from '@/i18n';
import { selectLocation, useSettings } from '@/store/settings';
import { colors } from '@/theme/colors';
import { fonts } from '@/theme/typography';

const CHOICES: readonly HolidaySourceChoice[] = ['auto', 'mufti', 'diyanet', 'ummalqura'];

/**
 * Настройки → Дати на празниците (етап 13): чии дати показва календарът на празниците.
 * Същият избор определя и датата по Хиджра в „Днес“ и „Месец“.
 */
export default function HolidaySourceScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const n = t.holidaySource;
  const choice = useSettings((s) => s.holidaySource ?? 'auto');
  const setChoice = useSettings((s) => s.setHolidaySource);
  const location = useSettings(selectLocation);
  const autoSource = resolveHolidaySource('auto', countryOf(location));

  const closing = useRef(false);
  const back = () => {
    if (closing.current) return;
    closing.current = true;
    if (router.canGoBack()) router.back();
    else router.replace('/settings');
  };

  const label = (c: HolidaySourceChoice) => (c === 'auto' ? n.auto : n[c]);
  const desc = (c: HolidaySourceChoice) =>
    c === 'auto' ? n.autoDesc(n.short[autoSource]) : c === 'mufti' ? n.muftiDesc : c === 'diyanet' ? n.diyanetDesc : n.ummalquraDesc;

  return (
    <View style={styles.root}>
      <GeometricPattern />
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={back} hitSlop={10} accessibilityRole="button" style={styles.backBtn}>
          <ChevronIcon direction="left" size={18} color={colors.gold} />
          <Text style={styles.backText}>{n.back}</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{n.title}</Text>
        <Text style={styles.intro}>{n.intro}</Text>

        <View style={styles.card} accessibilityRole="radiogroup" accessibilityLabel={n.title}>
          {CHOICES.map((c, i) => {
            const on = c === choice;
            return (
              <Pressable
                key={c}
                onPress={() => setChoice(c)}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                style={({ pressed }) => [styles.row, i > 0 && styles.border, on && styles.rowOn, pressed && styles.pressed]}
              >
                <View style={styles.text}>
                  <Text style={[styles.name, on && styles.nameOn]}>{label(c)}</Text>
                  <Text style={styles.desc}>{desc(c)}</Text>
                </View>
                <View style={[styles.radio, on && styles.radioOn]}>{on && <View style={styles.dot} />}</View>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.note}>{t.holidays.expectedNote}</Text>
        <Text style={styles.note}>{n.note}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.base },
  header: { paddingHorizontal: 16, paddingBottom: 4 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, alignSelf: 'flex-start' },
  backText: { fontFamily: fonts.bold, fontSize: 15, color: colors.gold },
  content: { paddingHorizontal: 16, gap: 8 },
  title: { fontFamily: fonts.extrabold, fontSize: 26, color: colors.text, marginTop: 4 },
  intro: { fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 19, color: colors.muted, marginBottom: 8 },
  card: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder, borderRadius: 18, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 11, minHeight: 66 },
  rowOn: { backgroundColor: 'rgba(212,168,87,0.10)' },
  border: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.10)' },
  pressed: { opacity: 0.7 },
  text: { flex: 1, gap: 2 },
  name: { fontFamily: fonts.bold, fontSize: 15.5, color: colors.text },
  nameOn: { fontFamily: fonts.extrabold, color: colors.gold },
  desc: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, color: colors.muted },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: 'rgba(242,239,232,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { borderColor: colors.gold },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.gold },
  note: { fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 18, color: colors.muted, marginTop: 6, paddingHorizontal: 4 },
});
