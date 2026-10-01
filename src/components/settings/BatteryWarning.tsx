import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useI18n } from '@/i18n';
import { useNotificationStatus } from '@/services/notifications';
import { colors } from '@/theme/colors';
import { fonts } from '@/theme/typography';

/**
 * Предупреждението най-горе в „Настройки“ (mockup v2): докато телефонът ограничава
 * Езан на заден план, алармите може да закъснеят. „Поправи“ → инструкциите за марката.
 */
export function BatteryWarning() {
  const { t } = useI18n();
  const n = t.notifications;
  const show = useNotificationStatus((s) => s.permission === 'granted' && s.battery === false);
  if (!show) return null;
  return (
    <View style={styles.box}>
      <Text style={styles.icon}>⚠</Text>
      <View style={styles.text}>
        <Text style={styles.title}>{n.batteryTitle}</Text>
        <Text style={styles.body}>{n.batteryText}</Text>
        <Pressable
          onPress={() => router.push('/battery')}
          accessibilityRole="button"
          style={({ pressed }) => [styles.fix, pressed && styles.pressed]}
        >
          <Text style={styles.fixText}>{n.batteryFix}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(227,154,75,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(227,154,75,0.45)',
  },
  icon: { fontSize: 18, color: colors.warn, marginTop: -1 },
  text: { flex: 1, gap: 2 },
  title: { fontFamily: fonts.bold, fontSize: 14, color: colors.warn },
  body: { fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 17, color: colors.textDim },
  fix: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: colors.warn,
  },
  pressed: { opacity: 0.8 },
  fixText: { fontFamily: fonts.extrabold, fontSize: 13, color: '#1F1206' },
});
