import { useEffect } from 'react';
import { AppState } from 'react-native';

import { registerBackgroundReschedule } from '@/services/backgroundTask';
import { refreshPermission, requestPermission, rescheduleNotifications } from '@/services/notifications';
import { useAlertPrefs } from '@/store/alertPrefs';
import { useSettings } from '@/store/settings';
import { useSounds } from '@/store/sounds';

/**
 * Пуска се веднъж в корена на приложението, след като настройките са заредени.
 * - при първо пускане пита за разрешение за известия;
 * - планира известията и ги пренасрочва при всяка промяна на мястото, часовете,
 *   камбанките, звуците, напомнянето и вибрацията (с малко изчакване, за да не се планира
 *   при всяко натискане на „+“);
 * - при връщане в приложението (и след „Аларми и напомняния“ в настройките на телефона);
 * - регистрира фоновата задача.
 */
export function useNotificationScheduler(ready: boolean) {
  useEffect(() => {
    if (!ready) return;

    (async () => {
      const permission = await refreshPermission();
      if (permission === 'undetermined') await requestPermission();
      await rescheduleNotifications();
      await registerBackgroundReschedule();
    })();

    let timer: ReturnType<typeof setTimeout> | undefined;
    const soon = () => {
      clearTimeout(timer);
      timer = setTimeout(rescheduleNotifications, 600);
    };
    const unsubSettings = useSettings.subscribe(soon);
    const unsubAlerts = useAlertPrefs.subscribe(soon);
    const unsubSounds = useSounds.subscribe(soon);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') rescheduleNotifications();
    });

    return () => {
      clearTimeout(timer);
      unsubSettings();
      unsubAlerts();
      unsubSounds();
      sub.remove();
    };
  }, [ready]);
}
