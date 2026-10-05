import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { colors } from '@/theme/colors';
import { fonts } from '@/theme/typography';

import { MosqueIcon } from '../icons';

import type { MosqueMapProps } from './mapTypes';

/**
 * Уеб версията (само за прегледа на екраните): MapLibre RN няма уеб част, затова точките
 * се рисуват върху схематичен фон в същия мащаб. В приложението е истинската карта.
 */
export function MosqueMap({ center, me, mosques, selectedId, onSelect, bottomInset, attribution, label, height }: MosqueMapProps) {
  const { width } = useWindowDimensions();
  const selected = mosques.find((m) => m.id === selectedId) ?? null;
  const usable = height - bottomInset - 90;

  // мащаб: избраната отблизо, иначе – ти и 5-те най-близки
  const focus = selected ? [selected] : [center, ...mosques.slice(0, 5)];
  const k = Math.cos((center.lat * Math.PI) / 180);
  const xs = focus.map((p) => p.lon * k);
  const ys = focus.map((p) => p.lat);
  const spanX = Math.max(...xs) - Math.min(...xs) || 0.004;
  const spanY = Math.max(...ys) - Math.min(...ys) || 0.004;
  const scale = selected ? 60000 : Math.min((width - 80) / spanX, usable / spanY);
  const cx = selected ? selected.lon * k : (Math.max(...xs) + Math.min(...xs)) / 2;
  const cy = selected ? selected.lat : (Math.max(...ys) + Math.min(...ys)) / 2;
  const toXY = (lat: number, lon: number) => ({
    x: width / 2 + (lon * k - cx) * scale,
    y: 90 + usable / 2 - (lat - cy) * scale,
  });

  return (
    <View style={[StyleSheet.absoluteFill, styles.bg]} accessibilityLabel={label}>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Path d={`M0 0 H${width} V110 C${width * 0.8} 104 ${width * 0.6} 92 0 46 Z`} fill="#0A1A2E" />
        <Path d={`M20 120 C90 130 160 150 250 170 S${width - 30} 200 ${width} 205`} stroke="rgba(255,255,255,0.16)" strokeWidth={5} fill="none" />
        <Path d={`M0 230 C80 222 170 230 240 250 S${width - 60} 290 ${width - 30} 330`} stroke="rgba(255,255,255,0.13)" strokeWidth={4} fill="none" />
        <Path d="M150 112 L170 430 M70 140 L95 430" stroke="rgba(255,255,255,0.09)" strokeWidth={3} fill="none" />
        <Path d={`M0 330 C100 320 200 340 ${width} 380`} stroke="rgba(255,255,255,0.09)" strokeWidth={3} fill="none" />
        <Path d={`M0 180 H${width} M0 280 H${width} M40 120 V430 M120 120 V430 M190 120 V430 M320 140 V430`} stroke="rgba(255,255,255,0.035)" strokeWidth={1} fill="none" />
      </Svg>
      {mosques.slice(0, 60).map((m, i) => {
        const { x, y } = toXY(m.lat, m.lon);
        if (x < -20 || x > width + 20 || y < -20 || y > height) return null;
        const sel = m.id === selectedId;
        const size = sel ? 36 : i === 0 ? 30 : i < 20 ? 26 : 12;
        return (
          <Pressable
            key={m.id}
            onPress={() => onSelect(m.id)}
            style={[styles.pin, { left: x - size / 2, top: y - size / 2, width: size, height: size, borderRadius: size / 2 }, sel && styles.sel]}
          >
            {size > 12 && <MosqueIcon size={sel ? 20 : 15} color={colors.goldInk} strokeWidth={2} />}
          </Pressable>
        );
      })}
      {me &&
        (() => {
          const { x, y } = toXY(me.lat, me.lon);
          return (
            <View style={[styles.meHalo, { left: x - 13, top: y - 13 }]}>
              <View style={styles.me} />
            </View>
          );
        })()}
      <Text style={[styles.attribution, { bottom: bottomInset + 6 }]}>{attribution}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { backgroundColor: '#13233A', overflow: 'hidden' },
  pin: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gold,
    borderWidth: 1.5,
    borderColor: 'rgba(26,20,8,0.6)',
  },
  sel: { borderWidth: 4, borderColor: 'rgba(212,168,87,0.35)' },
  meHalo: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(120,190,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  me: { width: 13, height: 13, borderRadius: 7, backgroundColor: '#6FB6FF', borderWidth: 2.5, borderColor: colors.text },
  attribution: { position: 'absolute', left: 10, fontFamily: fonts.medium, fontSize: 9.5, color: 'rgba(242,239,232,0.6)' },
});
