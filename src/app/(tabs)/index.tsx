import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NextPrayerHero } from '@/components/NextPrayerHero';
import { NoticeBanner } from '@/components/NoticeBanner';
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
import { requestPermission, useNotificationStatus } from '@/services/notifications';
import { useAlertPrefs } from '@/store/alertPrefs';
import { selectLocation, useSettings } from '@/store/settings';

export default function TodayScreen() {
  const insets = useSafeAreaInsets();
  const { t, pick } = useI18n();
  const tabBarHeight = useTabBarHeight();

  const now = useNow();
  const schedule = usePrayerSchedule(now);
  const location = useSettings(selectLocation);
  const hijriAdjust = useSettings((s) => s.hijriAdjust);
  const autoLocation = useSettings((s) => s.autoLocation);
  const hasPlace = useSettings((s) => s.gpsLocation !== null || s.manualLocation !== null);
  // „idle“ – само в първия миг преди първото търсене; броим го като търсене, за да не мигне „Избери място“
  const locating = useLocationStatus((s) => s.status === 'locating' || s.status === 'idle') && autoLocation;

  const cycle = useAlertPrefs((s) => s.cycle);
  const notificationsOff = useNotificationStatus(
    (s) => s.checked && (s.permission === 'denied' || s.permission === 'undetermined'),
  );
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);

  const onBellPress = useCallback(
    (id: PrayerId) => {
      // Без разрешение камбанката не се сменя: първо питаме за разрешение (или отваряме
      // настройките на телефона). Съобщението се показва СЛЕД въпроса – иначе прозорецът
      // на системата го скрива и потребителят не успява да го прочете.
      if (notificationsOff) {
        requestPermission().then((p) =>
          setToast({
            id: Date.now(),
            text: p === 'granted' ? t.notifications.allowedToast : t.notifications.bellDenied,
          }),
        );
        return;
      }
      const mode = cycle(id);
      const text = mode === 'adhan' ? t.alarmToast(t.prayers[id]) : t.toast(t.prayers[id], t.alert[mode]);
      setToast({ id: Date.now(), text });
    },
    [cycle, t, notificationsOff],
  );

  return (
    <View style={styles.root}>
      <PhaseBackground phase={schedule.current.id} />

      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top, paddingBottom: tabBarHeight + 16 }}
        showsVerticalScrollIndicator={false}
      >
        <TopBar
          city={pick(location.names)}
          gregorian={formatGregorianShort(now, t.date)}
          hijri={formatHijri(now, t.hijriMonths, hijriAdjust)}
          onCityPress={() => router.push('/place')}
          locating={locating}
          locatingFirstTime={!hasPlace}
        />
        <NoticeBanner />
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
