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

/** Кратко съобщение над долната навигация: появява се, стои 1.2 s и изчезва. */
export function Toast({ message, bottom }: Props) {
  const progress = useSharedValue(0);

  useEffect(() => {
    if (!message) return;
    progress.set(0);
    progress.set(
      withSequence(
        withTiming(1, { duration: 180 }),
        withDelay(1200, withTiming(0, { duration: 220 })),
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
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(8,12,22,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  text: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.text },
});
