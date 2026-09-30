import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { refreshLocation, useLocationStatus } from '@/services/location';
import { useSettings } from '@/store/settings';

const REFRESH_AFTER_MS = 30 * 60_000; // при връщане в приложението – ако последното определяне е по-старо от 30 мин.

/**
 * Пуска се веднъж в корена на приложението. При автоматично местоположение:
 * определя мястото при стартиране и при връщане в приложението след 30+ минути.
 */
export function useLocationUpdater() {
  // изчаква запазените настройки да се заредят, иначе би поискал GPS, преди да знае,
  // че потребителят е избрал място ръчно
  const [hydrated, setHydrated] = useState(() => useSettings.persist.hasHydrated());
  useEffect(() => useSettings.persist.onFinishHydration(() => setHydrated(true)), []);

  const auto = useSettings((s) => s.autoLocation);

  useEffect(() => {
    if (!hydrated || !auto) return;
    refreshLocation();
    const sub = AppState.addEventListener('change', (state) => {
      const { lastFix } = useLocationStatus.getState();
      if (state === 'active' && Date.now() - lastFix > REFRESH_AFTER_MS) refreshLocation();
    });
    return () => sub.remove();
  }, [hydrated, auto]);
}
