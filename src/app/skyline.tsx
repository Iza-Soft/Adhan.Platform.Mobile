import { router } from 'expo-router';
import { useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GeometricPattern } from '@/components/GeometricPattern';
import { ChevronIcon } from '@/components/icons';
import { NextPrayerHero } from '@/components/NextPrayerHero';
import { PhaseBackground } from '@/components/PhaseBackground';
import { SkylineThumb } from '@/components/Skyline';
import { SKYLINE_IDS, skylineOf } from '@/domain/skylines';
import { useNow } from '@/hooks/useNow';
import { usePrayerSchedule } from '@/hooks/usePrayerSchedule';
import { useI18n } from '@/i18n';
import { useSettings } from '@/store/settings';
import { colors } from '@/theme/colors';
import { fonts } from '@/theme/typography';

/**
 * Настройки → Изглед → Силует зад часовника.
 * Горе е истинският часовник от „Днес“ (с небето на текущата молитва) – сменя се веднага при избор.
 */
export default function SkylineScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const n = t.skyline;
  const choice = useSettings((s) => skylineOf(s.skyline));
  const setChoice = useSettings((s) => s.setSkyline);
  const now = useNow();
  const schedule = usePrayerSchedule(now);

  const closing = useRef(false);
  const back = () => {
    if (closing.current) return;
    closing.current = true;
    if (router.canGoBack()) router.back();
    else router.replace('/settings');
  };

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

        <View style={styles.preview} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <PhaseBackground phase={schedule.current.id} />
          <NextPrayerHero schedule={schedule} />
        </View>

        <View style={styles.card} accessibilityRole="radiogroup" accessibilityLabel={n.title}>
          {SKYLINE_IDS.map((id, i) => {
            const on = id === choice;
            return (
              <Pressable
                key={id}
                onPress={() => setChoice(id)}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                style={({ pressed }) => [styles.row, i > 0 && styles.border, on && styles.rowOn, pressed && styles.pressed]}
              >
                <SkylineThumb id={id} />
                <View style={styles.text}>
                  <Text style={[styles.name, on && styles.nameOn]}>{n.names[id]}</Text>
                  <Text style={styles.desc}>{n.places[id]}</Text>
                </View>
                <View style={[styles.radio, on && styles.radioOn]}>{on && <View style={styles.dot} />}</View>
              </Pressable>
            );
          })}
        </View>
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
  preview: {
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: 8,
  },
  card: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder, borderRadius: 18, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 10, paddingRight: 14, paddingVertical: 10, minHeight: 62 },
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
});
