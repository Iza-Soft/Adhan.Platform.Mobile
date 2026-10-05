import { StyleSheet, Text, View } from 'react-native';

import { formatCountdown, formatHM } from '@/domain/format';
import { PRAYERS, type Schedule } from '@/domain/prayers';
import { useI18n } from '@/i18n';
import { colors } from '@/theme/colors';
import { FONT_SCALE, fonts, tabularNums } from '@/theme/typography';

import { CountdownRing } from './CountdownRing';
import { Skyline } from './Skyline';

export function NextPrayerHero({ schedule }: { schedule: Schedule }) {
  const { t } = useI18n();
  const meta = PRAYERS[schedule.next.id];
  const time = formatHM(schedule.next.time);
  const at = schedule.isNextTomorrow ? t.hero.tomorrowAt(time) : t.hero.at(time);
  const countdown = formatCountdown(schedule.remainingMs);

  return (
    <View style={styles.hero}>
      <Skyline />
      <CountdownRing progress={schedule.progress}>
        <Text
          maxFontSizeMultiplier={FONT_SCALE.dense}
          style={styles.arabic}
          importantForAccessibility="no"
          accessibilityElementsHidden
        >
          {meta.arabic}
        </Text>
        <Text maxFontSizeMultiplier={FONT_SCALE.dense} style={styles.label}>
          {t.hero.next} · <Text maxFontSizeMultiplier={FONT_SCALE.dense} style={styles.labelStrong}>{t.prayers[schedule.next.id]}</Text>
        </Text>
        <Text maxFontSizeMultiplier={FONT_SCALE.dense} style={styles.count} accessibilityLabel={t.hero.remaining(countdown)}>
          {countdown}
        </Text>
        <Text maxFontSizeMultiplier={FONT_SCALE.dense} style={styles.at}>{at}</Text>
      </CountdownRing>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    height: 252,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arabic: {
    fontFamily: fonts.arabic,
    fontSize: 26,
    lineHeight: 36,
    color: colors.gold,
  },
  label: {
    fontFamily: fonts.semibold,
    fontSize: 12.5,
    color: 'rgba(242,239,232,0.78)',
  },
  labelStrong: {
    fontFamily: fonts.extrabold,
    color: colors.text,
  },
  count: {
    fontFamily: fonts.extrabold,
    fontSize: 38,
    lineHeight: 46,
    letterSpacing: -0.6,
    color: colors.text,
    ...tabularNums,
  },
  at: {
    fontFamily: fonts.medium,
    fontSize: 12.5,
    color: colors.textDim,
    ...tabularNums,
  },
});
