import { router } from 'expo-router';
import { Platform, Pressable, StyleSheet, Text } from 'react-native';

import { useI18n } from '@/i18n';
import { useLocationStatus } from '@/services/location';
import { openExactAlarmSettings, requestPermission, useNotificationStatus } from '@/services/notifications';
import { useSettings } from '@/store/settings';
import { colors } from '@/theme/colors';
import { fonts } from '@/theme/typography';

/**
 * Лента под горната лента на „Днес“, когато известията няма да дойдат навреме:
 * - известията са изключени → „Докосни, за да ги разрешиш“;
 * - Android без „Аларми и напомняния“ → известията може да закъснеят с минути.
 */
export function NoticeBanner() {
  const { t } = useI18n();
  const permission = useNotificationStatus((s) => s.permission);
  const exact = useNotificationStatus((s) => s.exact);
  const checked = useNotificationStatus((s) => s.checked);
  // още няма място (нито от GPS, нито избрано), а GPS не успя – показват се часовете за София
  const noPlace = useSettings((s) => !s.gpsLocation && !s.manualLocation);
  const locationFailed = useLocationStatus((s) => s.status === 'denied' || s.status === 'unavailable');

  let text: string | null = null;
  let onPress: (() => void) | null = null;
  if (noPlace && locationFailed) {
    text = t.noPlaceBanner;
    onPress = () => router.push('/place');
  } else if (!checked) {
    return null;
  } else if (permission === 'denied' || permission === 'undetermined') {
    text = t.notifications.deniedBanner;
    onPress = requestPermission;
  } else if (permission === 'granted' && Platform.OS === 'android' && exact === false) {
    text = t.notifications.exactBanner;
    onPress = openExactAlarmSettings;
  }
  if (!text || !onPress) return null;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.banner, pressed && styles.pressed]}
    >
      <Text style={styles.icon}>!</Text>
      <Text style={styles.text}>{text}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(227,154,75,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(227,154,75,0.45)',
  },
  pressed: { opacity: 0.75 },
  icon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    textAlign: 'center',
    lineHeight: 22,
    fontFamily: fonts.extrabold,
    fontSize: 13,
    color: colors.base,
    backgroundColor: colors.warn,
    overflow: 'hidden',
    includeFontPadding: false,
  },
  text: { flex: 1, fontFamily: fonts.semibold, fontSize: 12.5, lineHeight: 17, color: colors.text },
});
