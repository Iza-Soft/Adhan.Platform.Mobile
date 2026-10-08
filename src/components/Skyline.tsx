import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { SKYLINE_PATHS, type SkylineId } from '@/domain/skylines';
import { colors } from '@/theme/colors';
import { PHASE_GRADIENTS } from '@/theme/gradients';

/** Силуетът зад таймера – избира се в Настройки → Изглед. */
export function Skyline({ id }: { id: SkylineId }) {
  return (
    <Svg style={styles.svg} viewBox="0 0 360 80" preserveAspectRatio="none" pointerEvents="none">
      <Path fill={colors.skyline} d={SKYLINE_PATHS[id]} />
    </Svg>
  );
}

const SKY = [PHASE_GRADIENTS.dhuhr[1], PHASE_GRADIENTS.dhuhr[2]] as const;

/** Малка картинка на силуета (на небето на Зухр) – за избора в Настройки. */
export function SkylineThumb({ id, style }: { id: SkylineId; style?: StyleProp<ViewStyle> }) {
  return (
    <LinearGradient colors={SKY} style={[styles.thumb, style]} pointerEvents="none">
      <Svg width="100%" height="100%" viewBox="0 0 360 80" preserveAspectRatio="none">
        <Path fill="rgba(0,0,0,0.3)" d={SKYLINE_PATHS[id]} />
      </Svg>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  svg: { position: 'absolute', left: 0, right: 0, bottom: 0, width: '100%', height: 80 },
  thumb: { width: 78, height: 34, borderRadius: 8, overflow: 'hidden' },
});
