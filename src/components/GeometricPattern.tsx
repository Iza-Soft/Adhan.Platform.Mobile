import { StyleSheet } from 'react-native';
import Svg, { Circle, Defs, G, Path, Pattern, Rect } from 'react-native-svg';

import { colors } from '@/theme/colors';

/**
 * Геометрична шарка (8-лъчева звезда от два квадрата), повторена като плочки 60×60.
 * Рисува се в злато с ~7.5% прозрачност върху градиента.
 */
export function GeometricPattern({ opacity = 0.075 }: { opacity?: number }) {
  return (
    <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <Pattern id="girih" patternUnits="userSpaceOnUse" width={60} height={60}>
          <G fill="none" stroke={colors.gold} strokeWidth={1}>
            <Path d="M16 16h28v28H16z" />
            <Path d="M30 10.2L49.8 30L30 49.8L10.2 30z" />
            <Path d="M0 0L16 16M60 0L44 16M0 60L16 44M60 60L44 44M30 0V10.2M30 49.8V60M0 30H10.2M49.8 30H60" />
            <Circle cx={30} cy={30} r={6} />
          </G>
        </Pattern>
      </Defs>
      <Rect x={0} y={0} width="100%" height="100%" fill="url(#girih)" opacity={opacity} />
    </Svg>
  );
}
