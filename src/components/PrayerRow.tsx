import { StyleSheet, Text, View } from 'react-native';

import { formatHM } from '@/domain/format';
import { PRAYERS, type PrayerTime, type RowState } from '@/domain/prayers';
import { useI18n } from '@/i18n';
import type { AlertMode } from '@/store/alertPrefs';
import { colors } from '@/theme/colors';
import { fonts, tabularNums } from '@/theme/typography';

import { BellButton } from './BellButton';

interface Props {
  prayer: PrayerTime;
  state: RowState;
  mode: AlertMode;
  onBellPress: () => void;
  muted?: boolean;
}

export function PrayerRow({ prayer, state, mode, onBellPress, muted }: Props) {
  const { t } = useI18n();
  const meta = PRAYERS[prayer.id];
  const name = t.prayers[prayer.id];
  const isNow = state === 'now';

  return (
    <View style={[styles.row, isNow && styles.now, state === 'past' && styles.past]}>
      <View style={styles.names}>
        <Text style={[styles.name, isNow && styles.nameNow]}>{name}</Text>
        <Text style={styles.arabic}>{meta.arabic}</Text>
        {isNow && (
          <View style={styles.pill}>
            <Text style={styles.pillText}>{t.nowPill}</Text>
          </View>
        )}
      </View>
      <Text style={[styles.time, isNow && styles.timeNow]}>{formatHM(prayer.time)}</Text>
      <BellButton
        mode={mode}
        accessibilityLabel={t.a11y.bell(name, t.alert[mode])}
        onPress={onBellPress}
        muted={muted}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 46,
    paddingLeft: 14,
    paddingRight: 6,
    borderRadius: 15,
    gap: 12,
  },
  now: {
    backgroundColor: colors.nowRow,
    borderWidth: 1,
    borderColor: colors.nowRowBorder,
  },
  past: { opacity: 0.5 },
  names: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0 },
  name: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  nameNow: { fontFamily: fonts.extrabold },
  arabic: {
    fontFamily: fonts.arabic,
    fontSize: 15,
    lineHeight: 22,
    color: 'rgba(242,239,232,0.5)',
  },
  pill: {
    backgroundColor: colors.gold,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  pillText: {
    fontFamily: fonts.extrabold,
    fontSize: 10,
    letterSpacing: 0.8,
    color: colors.goldInk,
  },
  time: { fontFamily: fonts.bold, fontSize: 16, color: colors.text, ...tabularNums },
  timeNow: { color: colors.gold },
});
