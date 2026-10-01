import { Pressable, StyleSheet } from 'react-native';

import type { AlertMode } from '@/store/alertPrefs';
import { colors } from '@/theme/colors';

import { AlertIcon } from './icons';

interface Props {
  mode: AlertMode;
  /** Готов текст за TalkBack/VoiceOver на текущия език. */
  accessibilityLabel: string;
  onPress: () => void;
  /** Известията не са разрешени – камбанката е бледа: нищо няма да прозвучи. */
  muted?: boolean;
}

/** Сиво = изключено, бяло = нотификация, злато = езан. */
export function BellButton({ mode, accessibilityLabel, onPress, muted }: Props) {
  const iconColor = mode === 'adhan' ? colors.goldInk : mode === 'notify' ? colors.text : colors.muted;

  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [styles.btn, styles[mode], muted && styles.muted, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <AlertIcon mode={mode} color={iconColor} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  off: { backgroundColor: 'transparent' },
  notify: { backgroundColor: colors.bellNotify },
  adhan: { backgroundColor: colors.gold },
  muted: { opacity: 0.3 },
  pressed: { transform: [{ scale: 0.92 }] },
});
