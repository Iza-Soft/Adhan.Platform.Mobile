import { StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { colors } from '@/theme/colors';

/** Силует на купол с две минарета зад таймера. */
export function Skyline() {
  return (
    <Svg
      style={styles.svg}
      viewBox="0 0 360 80"
      preserveAspectRatio="none"
      pointerEvents="none"
    >
      <Path
        fill={colors.skyline}
        d="M0 80V70H56V24L60 8L64 24V70H120V58C120 36 148 22 179 18V8H181V18C212 22 240 36 240 58V70H292V24L296 8L300 24V70H360V80Z"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  svg: { position: 'absolute', left: 0, right: 0, bottom: 0, width: '100%', height: 80 },
});
