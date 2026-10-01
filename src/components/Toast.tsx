import { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { colors } from '@/theme/colors';
import { fonts } from '@/theme/typography';

interface Props {
  /** Ново съобщение идва с нов `id`, за да се покаже отново и при същия текст. */
  message: { id: number; text: string } | null;
  bottom: number;
}

/**
 * Кратко съобщение над долната навигация. Стои според дължината на текста:
 * „Иша: езан“ – ~2 сек., дълго обяснение – до 6 сек., за да може да се прочете.
 */
export function toastDuration(text: string): number {
  return Math.min(6000, Math.max(1800, 1200 + text.length * 50));
}

export function Toast({ message, bottom }: Props) {
  const progress = useSharedValue(0);

  useEffect(() => {
    if (!message) return;
    progress.set(0);
    progress.set(
      withSequence(
        withTiming(1, { duration: 180 }),
        withDelay(toastDuration(message.text), withTiming(0, { duration: 220 })),
      ),
    );
  }, [message, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.get(),
    transform: [{ translateY: (1 - progress.get()) * 8 }],
  }));

  if (!message) return null;

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={[styles.toast, { bottom }, animatedStyle]}
    >
      <Text style={styles.text}>{message.text}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    maxWidth: '90%',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 18,
    backgroundColor: 'rgba(8,12,22,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  text: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18, color: colors.text, textAlign: 'center' },
});
