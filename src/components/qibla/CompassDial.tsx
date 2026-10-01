import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, G, Line, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { angleDelta } from '@/domain/qibla';
import { colors } from '@/theme/colors';
import { fonts } from '@/theme/typography';

interface Props {
  size: number;
  /** Посоката към Кааба от север (0–360). */
  qibla: number;
  /** Непрекъсната посока на телефона (виж useCompass → rotation). */
  rotation: number;
  aligned: boolean;
  /** Къде е слънцето (0–360° от север), когато е над хоризонта; иначе null. */
  sun?: number | null;
  /** С, И, Ю, З / N, E, S, W */
  letters: readonly string[];
  accessibilityLabel: string;
}

const GOLD = colors.gold;
const SUN = colors.sun;
const NUMBERS = [30, 60, 120, 150, 210, 240, 300, 330];
/** Въртящият се слой е малко по-голям от компаса, за да не се отрязва сиянието на слънцето. */
const PAD = 12;
/** Слънцето и Кааба са „заедно“ – слънцето огрява знака на Кааба. */
const SUN_WITH_KAABA_DEG = 3;

/**
 * Компасът: скалата се върти така, че „С“ винаги сочи истинския север; знакът на Кааба
 * е на ръба в посоката на Киблата; стрелката в средата сочи към Кааба спрямо телефона;
 * триъгълникът горе показва накъде гледа телефонът. Буквите и числата остават изправени.
 */
export function CompassDial({ size, qibla, rotation, aligned, sun = null, letters, accessibilityLabel }: Props) {
  const rot = useSharedValue(rotation);
  useEffect(() => {
    rot.set(withTiming(rotation, { duration: 120 }));
  }, [rotation, rot]);

  const dialStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${-rot.get()}deg` }] }));
  const uprightStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rot.get()}deg` }] }));
  const arrowStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${qibla - rot.get()}deg` }] }));

  const c = size / 2;
  const R = c - 22; // радиус на скалата
  const ring = aligned ? GOLD : 'rgba(255,255,255,0.10)';
  const arrow = aligned ? GOLD : colors.text;

  // позиция на етикет на ъгъл `deg` и разстояние `r` от центъра
  const at = (deg: number, r: number) => {
    const a = (deg * Math.PI) / 180;
    return { left: c + r * Math.sin(a), top: c - r * Math.cos(a) };
  };

  const ticks = [];
  for (let d = 0; d < 360; d += 5) {
    const long = d % 30 === 0;
    const a = (d * Math.PI) / 180;
    const r1 = R - (long ? 14 : 7);
    ticks.push(
      <Line
        key={d}
        x1={c + r1 * Math.sin(a)}
        y1={c - r1 * Math.cos(a)}
        x2={c + R * Math.sin(a)}
        y2={c - R * Math.cos(a)}
        stroke={`rgba(242,239,232,${long ? 0.55 : 0.22})`}
        strokeWidth={long ? 2 : 1.2}
        strokeLinecap="round"
      />,
    );
  }

  const kaaba = at(qibla, R + 2);
  const sunWithKaaba = sun !== null && Math.abs(angleDelta(qibla, sun)) <= SUN_WITH_KAABA_DEG;
  const sunPos = sun !== null && !sunWithKaaba ? at(sun, R + 2) : null;

  return (
    <View
      style={{ width: size, height: size }}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      {/* фон, рамка и сияние (не се върти) */}
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={aligned ? 'rgba(212,168,87,0.35)' : 'rgba(255,255,255,0.06)'} />
            <Stop offset="1" stopColor="rgba(0,0,0,0)" />
          </RadialGradient>
        </Defs>
        <Circle cx={c} cy={c} r={c - 6} fill="rgba(6,10,20,0.45)" stroke={ring} strokeWidth={aligned ? 2.5 : 1} />
        <Circle cx={c} cy={c} r={R - 14} fill="url(#glow)" />
      </Svg>

      {/* скалата – върти се */}
      <Animated.View style={[styles.dial, { width: size + 2 * PAD, height: size + 2 * PAD }, dialStyle]}>
        <Svg width={size + 2 * PAD} height={size + 2 * PAD} viewBox={`${-PAD} ${-PAD} ${size + 2 * PAD} ${size + 2 * PAD}`}>
          {ticks}
          {sunPos && <SunMark x={sunPos.left} y={sunPos.top} />}
          {sunWithKaaba && (
            <G>
              <Circle cx={kaaba.left} cy={kaaba.top} r={27} fill="rgba(246,196,83,0.18)" />
              <SunRays x={kaaba.left} y={kaaba.top} r1={20} r2={26} />
            </G>
          )}
          <G transform={`translate(${kaaba.left} ${kaaba.top}) rotate(${qibla})`}>
            <Circle r={16} fill={GOLD} />
            <Rect x={-7} y={-7.5} width={14} height={15} rx={1.5} fill={colors.goldInk} />
            <Rect x={-7} y={-4.2} width={14} height={2.4} fill={GOLD} />
          </G>
        </Svg>
        {letters.map((l, i) => {
          const p = at(i * 90, R - 30);
          return (
            <Animated.View key={l} style={[styles.label, { left: PAD + p.left - 14, top: PAD + p.top - 12 }, uprightStyle]}>
              <Text style={[styles.letter, i === 0 && styles.north]}>{l}</Text>
            </Animated.View>
          );
        })}
        {NUMBERS.map((n) => {
          const p = at(n, R - 28);
          return (
            <Animated.View key={n} style={[styles.label, { left: PAD + p.left - 14, top: PAD + p.top - 12 }, uprightStyle]}>
              <Text style={styles.number}>{n}</Text>
            </Animated.View>
          );
        })}
      </Animated.View>

      {/* стрелката към Кааба */}
      <Animated.View style={[StyleSheet.absoluteFill, arrowStyle]}>
        <Svg width={size} height={size}>
          <Path
            d={`M${c} ${c - R + 30} L${c + 18} ${c - R + 74} L${c + 6} ${c - R + 70} L${c + 6} ${c + 32} L${c - 6} ${c + 32} L${c - 6} ${c - R + 70} L${c - 18} ${c - R + 74} Z`}
            fill={arrow}
          />
          <Circle cx={c} cy={c} r={11} fill={colors.base} stroke={arrow} strokeWidth={3} />
        </Svg>
      </Animated.View>

      {/* накъде гледа телефонът – винаги горе */}
      <Svg width={size} height={size} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Path d={`M${c} 0 L${c + 10} 16 L${c - 10} 16 Z`} fill={aligned ? GOLD : 'rgba(242,239,232,0.85)'} />
      </Svg>
    </View>
  );
}

/** Лъчите на слънцето около точка. */
function SunRays({ x, y, r1, r2 }: { x: number; y: number; r1: number; r2: number }) {
  return (
    <G>
      {[0, 45, 90, 135, 180, 225, 270, 315].map((d) => {
        const a = (d * Math.PI) / 180;
        return (
          <Line
            key={d}
            x1={x + r1 * Math.sin(a)}
            y1={y - r1 * Math.cos(a)}
            x2={x + r2 * Math.sin(a)}
            y2={y - r2 * Math.cos(a)}
            stroke={SUN}
            strokeWidth={2.2}
            strokeLinecap="round"
          />
        );
      })}
    </G>
  );
}

/** Знакът на слънцето върху ръба на компаса. */
function SunMark({ x, y }: { x: number; y: number }) {
  return (
    <G>
      <Circle cx={x} cy={y} r={16} fill={colors.base} stroke="rgba(246,196,83,0.55)" strokeWidth={1} />
      <SunRays x={x} y={y} r1={9.5} r2={13} />
      <Circle cx={x} cy={y} r={6.5} fill={SUN} />
    </G>
  );
}

const styles = StyleSheet.create({
  dial: { position: 'absolute', left: -PAD, top: -PAD },
  label: { position: 'absolute', width: 28, height: 24, alignItems: 'center', justifyContent: 'center' },
  letter: { fontFamily: fonts.extrabold, fontSize: 16, color: 'rgba(242,239,232,0.8)', includeFontPadding: false },
  north: { color: colors.warn },
  number: { fontFamily: fonts.semibold, fontSize: 10, color: colors.muted, includeFontPadding: false },
});
