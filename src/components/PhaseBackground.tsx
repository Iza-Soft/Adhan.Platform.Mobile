import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import type { PrayerId } from '@/domain/prayers';
import { GRADIENT_LOCATIONS, PHASE_GRADIENTS } from '@/theme/gradients';

import { GeometricPattern } from './GeometricPattern';

function Gradient({ phase }: { phase: PrayerId }) {
  return (
    <LinearGradient
      colors={PHASE_GRADIENTS[phase]}
      locations={GRADIENT_LOCATIONS}
      style={StyleSheet.absoluteFill}
    />
  );
}

/**
 * Градиентът на текущата молитва на целия екран (решение №3).
 * При смяна на молитвата новият градиент плавно се появява върху стария (1.1 s).
 */
export function PhaseBackground({ phase }: { phase: PrayerId }) {
  // „below“ е предишната молитва, „above“ – текущата, която се появява отгоре.
  const [layers, setLayers] = useState({ below: phase, above: phase });
  if (layers.above !== phase) {
    // Обновяване на state по време на render при смяна на prop – официално разрешен React модел.
    setLayers({ below: layers.above, above: phase });
  }

  const opacity = useSharedValue(1);
  useEffect(() => {
    opacity.set(0);
    opacity.set(withTiming(1, { duration: 1100 }));
  }, [layers.above, opacity]);

  const aboveStyle = useAnimatedStyle(() => ({ opacity: opacity.get() }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Gradient phase={layers.below} />
      <Animated.View style={[StyleSheet.absoluteFill, aboveStyle]}>
        <Gradient phase={layers.above} />
      </Animated.View>
      <GeometricPattern />
    </View>
  );
}
