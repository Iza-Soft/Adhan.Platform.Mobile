import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { colors } from '@/theme/colors';

interface Props {
  progress: number; // 0..1
  size?: number;
  strokeWidth?: number;
  children?: ReactNode;
}

/** Кръгов прогрес: колко от времето до следващата молитва е изминало. */
export function CountdownRing({ progress, size = 214, strokeWidth = 5, children }: Props) {
  const r = (size - strokeWidth) / 2 - 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.min(1, Math.max(0, progress)));

  return (
    <View style={{ width: size, height: size }}>
      {/* -90°, за да започва от 12 часа */}
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={colors.ringTrack}
          strokeWidth={strokeWidth}
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={colors.gold}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={offset}
        />
      </Svg>
      <View style={styles.center}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
