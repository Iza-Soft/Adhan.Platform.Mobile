import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NextPrayerHero } from '@/components/NextPrayerHero';
import { PhaseBackground } from '@/components/PhaseBackground';
import { PrayerList } from '@/components/PrayerList';
import { useTabBarHeight } from '@/components/TabBar';
import { Toast } from '@/components/Toast';
import { TopBar } from '@/components/TopBar';
import { formatGregorianShort } from '@/domain/format';
import { formatHijri } from '@/domain/hijri';
import type { PrayerId } from '@/domain/prayers';
import { useNow } from '@/hooks/useNow';
import { usePrayerSchedule } from '@/hooks/usePrayerSchedule';
import { useI18n } from '@/i18n';
import { useLocationStatus } from '@/services/location';
import { useAlertPrefs } from '@/store/alertPrefs';
import { selectLocation, useSettings } from '@/store/settings';

export default function TodayScreen() {
  const insets = useSafeAreaInsets();
  const { lang, t } = useI18n();
  const tabBarHeight = useTabBarHeight();

  const now = useNow();
  const schedule = usePrayerSchedule(now);
  const location = useSettings(selectLocation);
  const hijriAdjust = useSettings((s) => s.hijriAdjust);
  const autoLocation = useSettings((s) => s.autoLocation);
  const hasGpsLocation = useSettings((s) => s.gpsLocation !== null);
  const locating = useLocationStatus((s) => s.status === 'locating') && autoLocation;

  const cycle = useAlertPrefs((s) => s.cycle);
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);

  const onBellPress = useCallback(
    (id: PrayerId) => {
      const mode = cycle(id);
      setToast({ id: Date.now(), text: t.toast(t.prayers[id], t.alert[mode]) });
    },
    [cycle, t],
  );

  return (
    <View style={styles.root}>
      <PhaseBackground phase={schedule.current.id} />

      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top, paddingBottom: tabBarHeight + 16 }}
        showsVerticalScrollIndicator={false}
      >
        <TopBar
          city={location.names[lang]}
          gregorian={formatGregorianShort(now, t.date)}
          hijri={formatHijri(now, t.hijriMonths, hijriAdjust)}
          onCityPress={() => router.push('/place')}
          locating={locating}
          locatingFirstTime={!hasGpsLocation}
        />
        <NextPrayerHero schedule={schedule} />
        <PrayerList schedule={schedule} onBellPress={onBellPress} />
      </ScrollView>

      <Toast message={toast} bottom={tabBarHeight + 14} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
