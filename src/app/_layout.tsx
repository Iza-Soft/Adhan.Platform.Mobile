import { Amiri_400Regular, Amiri_700Bold } from '@expo-google-fonts/amiri';
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';

import { useLocationUpdater } from '@/hooks/useLocationUpdater';
import { useNotificationScheduler } from '@/hooks/useNotificationScheduler';
// дефинира фоновата задача при зареждане на кода (виж файла)
import '@/services/backgroundTask';
import { configureNotificationHandler } from '@/services/notifications';
import { useAlertPrefs } from '@/store/alertPrefs';
import { useSettings } from '@/store/settings';
import { colors } from '@/theme/colors';

// Splash екранът стои, докато шрифтовете и запазените настройки се заредят –
// иначе за миг би се показала София по подразбиране вместо твоето място.
SplashScreen.preventAutoHideAsync();
// известие, дошло докато приложението е отворено, се показва като обикновено – със звук
configureNotificationHandler();

function useStoresHydrated(): boolean {
  const [done, setDone] = useState(
    () => useSettings.persist.hasHydrated() && useAlertPrefs.persist.hasHydrated(),
  );
  useEffect(() => {
    const check = () => setDone(useSettings.persist.hasHydrated() && useAlertPrefs.persist.hasHydrated());
    const a = useSettings.persist.onFinishHydration(check);
    const b = useAlertPrefs.persist.onFinishHydration(check);
    check();
    // предпазител: ако четенето от паметта на телефона се провали, zustand не съобщава
    // „готово“ – след 2 сек. приложението се показва с настройките по подразбиране
    const timer = setTimeout(() => setDone(true), 2000);
    return () => {
      a();
      b();
      clearTimeout(timer);
    };
  }, []);
  return done;
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
    Amiri_400Regular,
    Amiri_700Bold,
  });

  const hydrated = useStoresHydrated();
  const ready = (loaded || !!error) && hydrated;
  useNotificationScheduler(hydrated);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  // GPS при стартиране и при връщане в приложението (ако мястото е автоматично)
  useLocationUpdater();

  if (!ready) return null;

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.base },
        }}
      >
        <Stack.Screen name="(tabs)" />
        {/* изборът на място се отваря отдолу нагоре като модален екран */}
        <Stack.Screen name="place" options={{ presentation: 'modal' }} />
        <Stack.Screen name="about" />
        <Stack.Screen name="diagnostics" />
      </Stack>
    </>
  );
}
