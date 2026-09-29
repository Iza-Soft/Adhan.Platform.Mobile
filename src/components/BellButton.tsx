import { Pressable, StyleSheet } from 'react-native';

import type { AlertMode } from '@/store/alertPrefs';
import { colors } from '@/theme/colors';

import { AlertIcon } from './icons';

interface Props {
  mode: AlertMode;
  /** Готов текст за TalkBack/VoiceOver на текущия език. */
  accessibilityLabel: string;
  onPress: () => void;
}

/** Сиво = изключено, бяло = нотификация, злато = езан. */
export function BellButton({ mode, accessibilityLabel, onPress }: Props) {
  const iconColor = mode === 'adhan' ? colors.goldInk : mode === 'notify' ? colors.text : colors.muted;

  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [styles.btn, styles[mode], pressed && styles.pressed]}
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
  pressed: { transform: [{ scale: 0.92 }] },
});
