import { StyleSheet, View } from 'react-native';

import type { PrayerId, Schedule } from '@/domain/prayers';
import { useNotificationStatus } from '@/services/notifications';
import { useAlertPrefs } from '@/store/alertPrefs';
import { colors } from '@/theme/colors';

import { PrayerRow } from './PrayerRow';

interface Props {
  schedule: Schedule;
  onBellPress: (id: PrayerId) => void;
}

export function PrayerList({ schedule, onBellPress }: Props) {
  const modes = useAlertPrefs((s) => s.modes);
  // без разрешение за известия камбанките са бледи – нищо няма да прозвучи
  const muted = useNotificationStatus(
    (s) => s.checked && (s.permission === 'denied' || s.permission === 'undetermined'),
  );

  return (
    <View style={styles.card}>
      {schedule.today.map((p) => (
        <PrayerRow
          key={p.id}
          prayer={p}
          state={schedule.rowState(p.id)}
          mode={modes[p.id]}
          onBellPress={() => onBellPress(p.id)}
          muted={muted}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 14,
    padding: 6,
    gap: 2,
    borderRadius: 22,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
});
