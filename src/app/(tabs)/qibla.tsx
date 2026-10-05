import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { router, useIsFocused } from 'expo-router';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GeometricPattern } from '@/components/GeometricPattern';
import { ChevronDownIcon, PinIcon } from '@/components/icons';
import { CompassDial } from '@/components/qibla/CompassDial';
import { useTabBarHeight } from '@/components/TabBar';
import { formatHM } from '@/domain/format';
import { distanceToKaabaKm, qiblaBearing, turnInstruction } from '@/domain/qibla';
import { isSunUp, sunPosition, sunQiblaHint, sunriseBearing, type SunQiblaHint } from '@/domain/sun';
import { useCompass } from '@/hooks/useCompass';
import { useNow } from '@/hooks/useNow';
import { useI18n } from '@/i18n';
import { selectLocation, useSettings } from '@/store/settings';
import { colors } from '@/theme/colors';
import { fonts, tabularNums } from '@/theme/typography';

const QUALITY_COLOR = { high: '#5FBF8F', medium: colors.gold, low: colors.warn } as const;

/** Екран „Кибла“: компас със стрелка към Кааба, градуси от север и разстояние до Мека. */
export default function QiblaScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useTabBarHeight();
  const { t, pick } = useI18n();
  const q = t.qibla;
  const location = useSettings(selectLocation);
  const hasPlace = useSettings((s) => s.gpsLocation !== null || s.manualLocation !== null);

  // сензорите работят само докато екранът е отворен – пести батерия
  const focused = useIsFocused();
  const compass = useCompass(location.latitude, location.longitude, focused);

  const bearing = qiblaBearing(location.latitude, location.longitude);
  const bearingText = Math.round(bearing);
  const km = Math.round(distanceToKaabaKm(location.latitude, location.longitude));
  // „2 820“ – с интервал за хилядите (неразделим); без Intl (в Hermes е бавен и различен по телефони)
  const kmText = String(km).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0');

  // слънцето: къде е сега и кога е точно в посоката на Киблата (обновява се на 30 сек.;
  // React Compiler пази резултатите между прерисуванията от компаса)
  const now = useNow(30_000);
  const sunNow = sunPosition(now, location.latitude, location.longitude);
  const sunAzimuth = isSunUp(sunNow) ? sunNow.azimuth : null;
  const hint = sunQiblaHint(now, location.latitude, location.longitude, bearing);
  const sunriseText = hint ? sunriseLine(hint, location.latitude, location.longitude, bearing, q.sunrise) : null;

  const live = compass.status === 'ok' && compass.heading !== null;
  const turn = live ? turnInstruction(bearing, compass.heading!) : null;
  const aligned = !!turn?.aligned;

  // кратка вибрация, когато човек застане точно към Кибла
  const wasAligned = useRef(false);
  useEffect(() => {
    if (aligned && !wasAligned.current) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    wasAligned.current = aligned;
  }, [aligned]);

  const allowLocation = async () => {
    await Location.requestForegroundPermissionsAsync();
    compass.retry();
  };

  // без компас скалата стои неподвижно със „С“ горе, а стрелката сочи Киблата от север
  const rotation = live ? compass.rotation : 0;

  return (
    <View style={styles.root}>
      <GeometricPattern />
      <ScrollView
        style={{ marginBottom: tabBarHeight }}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 8 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.top}>
          <Pressable
            onPress={() => router.push('/place')}
            accessibilityRole="button"
            accessibilityLabel={t.a11y.city(pick(location.names))}
            style={({ pressed }) => [styles.city, pressed && styles.pressed]}
          >
            <PinIcon color={colors.text} />
            <Text style={styles.cityText}>{hasPlace ? pick(location.names) : t.choosePlace}</Text>
            <ChevronDownIcon color={colors.text} />
          </Pressable>
          {live && (
            <View style={styles.acc}>
              <View style={[styles.dot, { backgroundColor: QUALITY_COLOR[compass.quality] }]} />
              <Text style={styles.accText}>{q.accuracy(q.quality[compass.quality])}</Text>
            </View>
          )}
        </View>

        <View style={styles.titleRow}>
          <Text style={styles.title}>{q.title}</Text>
          <Text style={styles.arabic}>القبلة</Text>
        </View>

        <View style={[styles.pill, aligned && styles.pillGold]}>
          {compass.status === 'starting' ? (
            <>
              <ActivityIndicator size="small" color={colors.gold} />
              <Text style={styles.pillText}>{q.starting}</Text>
            </>
          ) : aligned ? (
            <Text style={[styles.pillText, styles.pillTextGold]}>{q.aligned}</Text>
          ) : turn ? (
            <Text style={styles.pillText}>
              {q.turnLabel(turn.direction)} ·{' '}
              <Text style={styles.pillDeg}>
                {turn.degrees}° {turn.direction === 'right' ? '↻' : '↺'}
              </Text>
            </Text>
          ) : (
            <Text style={styles.pillText}>{compass.status === 'needsPermission' ? q.permissionTitle : q.noCompassTitle}</Text>
          )}
        </View>

        <View style={styles.dial}>
          <CompassDial
            size={300}
            qibla={bearing}
            rotation={rotation}
            aligned={aligned}
            sun={sunAzimuth}
            letters={q.letters}
            accessibilityLabel={q.a11yDial(bearingText)}
          />
        </View>

        <View style={styles.nums}>
          <View>
            <Text style={styles.big}>{bearingText}°</Text>
            <Text style={styles.lbl}>{q.fromNorth}</Text>
          </View>
          <View style={styles.sep} />
          <View>
            <Text style={styles.big}>
              {kmText} <Text style={styles.unit}>{q.km}</Text>
            </Text>
            <Text style={styles.lbl}>{q.toMecca}</Text>
          </View>
        </View>

        {hint && <SunCard hint={hint} sub={sunriseText} />}

        {compass.status === 'unavailable' ? (
          <Card title={q.noCompassTitle} text={q.noCompassText(bearingText)} />
        ) : compass.status === 'needsPermission' ? (
          <Card title={q.permissionTitle} text={q.permissionText} action={{ label: q.allowLocation, onPress: allowLocation }} />
        ) : live && compass.quality === 'low' ? (
          <Card title={q.calibrateTitle} text={q.calibrateText} figureEight />
        ) : (
          <Text style={styles.tip}>{q.tip}</Text>
        )}
      </ScrollView>
    </View>
  );
}

/** „Изгрев на 94° – Киблата е 48° вдясно от него“ – за деня от подсказката. */
function sunriseLine(
  hint: SunQiblaHint,
  lat: number,
  lon: number,
  qibla: number,
  format: (azimuth: number, degrees: number, side: 'left' | 'right' | 'same') => string,
): string | null {
  const b = sunriseBearing(hint.time, lat, lon, qibla);
  return b ? format(Math.round(b.azimuth), b.degrees, b.side) : null;
}

/** „Днес в 11:18 слънцето е точно в посоката на Киблата“ + изгревът спрямо Киблата. */
function SunCard({ hint, sub }: { hint: SunQiblaHint; sub: string | null }) {
  const { t } = useI18n();
  const q = t.qibla;
  const gold = hint.kind === 'now';
  const template = hint.kind === 'now' ? q.sunNow : hint.kind === 'today' ? q.sunToday : q.sunTomorrow;
  const [before, after = ''] = template.split('{t}');
  const hasTime = template.includes('{t}');
  return (
    <View style={[styles.sunCard, gold && styles.sunCardGold]} accessible>
      <SunIcon color={gold ? colors.goldInk : colors.sun} />
      <View style={styles.cardText}>
        <Text style={[styles.sunMain, gold && styles.sunMainGold]}>
          {before}
          {hasTime && <Text style={[styles.sunTime, gold && styles.sunMainGold]}>{formatHM(hint.time)}</Text>}
          {after}
        </Text>
        {sub && !gold && <Text style={styles.sunSub}>{sub}</Text>}
      </View>
    </View>
  );
}

function SunIcon({ color }: { color: string }) {
  const rays = [0, 45, 90, 135, 180, 225, 270, 315];
  return (
    <Svg width={26} height={26} viewBox="-13 -13 26 26">
      {rays.map((d) => {
        const a = (d * Math.PI) / 180;
        return (
          <Line
            key={d}
            x1={8 * Math.sin(a)}
            y1={-8 * Math.cos(a)}
            x2={11.5 * Math.sin(a)}
            y2={-11.5 * Math.cos(a)}
            stroke={color}
            strokeWidth={2.2}
            strokeLinecap="round"
          />
        );
      })}
      <Circle r={5.5} fill={color} />
    </Svg>
  );
}

function Card({
  title,
  text,
  action,
  figureEight,
}: {
  title: string;
  text: string;
  action?: { label: string; onPress: () => void };
  figureEight?: boolean;
}) {
  return (
    <View style={styles.card}>
      {figureEight && (
        <Svg width={64} height={40} viewBox="0 0 74 44">
          <Path
            d="M37 22 C 50 4, 70 4, 70 22 C 70 40, 50 40, 37 22 C 24 4, 4 4, 4 22 C 4 40, 24 40, 37 22 Z"
            fill="none"
            stroke={colors.warn}
            strokeWidth={2.5}
            strokeDasharray="5 4"
          />
          <Rect x={31} y={14} width={12} height={17} rx={3} fill={colors.text} />
        </Svg>
      )}
      <View style={styles.cardText}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardBody}>{text}</Text>
        {action && (
          <Pressable onPress={action.onPress} accessibilityRole="button" style={styles.cardBtn}>
            <Text style={styles.cardBtnText}>{action.label}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.base },
  content: { alignItems: 'center', paddingBottom: 24 },
  top: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
  },
  city: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingLeft: 10,
    paddingRight: 12,
    borderRadius: 999,
    backgroundColor: colors.pill,
  },
  pressed: { opacity: 0.7 },
  cityText: { fontFamily: fonts.bold, fontSize: 14, color: colors.text },
  acc: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  accText: { fontFamily: fonts.semibold, fontSize: 11.5, color: colors.muted },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginTop: 16 },
  title: { fontFamily: fonts.extrabold, fontSize: 26, color: colors.text },
  arabic: { fontFamily: fonts.arabicBold, fontSize: 24, color: colors.gold },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  pillGold: { backgroundColor: colors.gold, borderColor: colors.gold },
  pillText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  pillTextGold: { fontFamily: fonts.extrabold, color: colors.goldInk },
  pillDeg: { fontFamily: fonts.extrabold, color: colors.gold, ...tabularNums },
  dial: { marginTop: 14 },
  nums: { flexDirection: 'row', alignItems: 'center', gap: 22, marginTop: 10 },
  big: { fontFamily: fonts.extrabold, fontSize: 30, color: colors.text, textAlign: 'center', ...tabularNums },
  unit: { fontFamily: fonts.bold, fontSize: 16, color: colors.muted },
  lbl: { fontFamily: fonts.semibold, fontSize: 12, color: colors.muted, textAlign: 'center' },
  sep: { width: StyleSheet.hairlineWidth, height: 40, backgroundColor: 'rgba(255,255,255,0.2)' },
  tip: {
    marginTop: 16,
    marginHorizontal: 28,
    fontFamily: fonts.regular,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.muted,
    textAlign: 'center',
  },
  sunCard: {
    alignSelf: 'stretch',
    marginTop: 14,
    marginHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(246,196,83,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(246,196,83,0.28)',
  },
  sunCardGold: { backgroundColor: colors.gold, borderColor: colors.gold },
  sunMain: { fontFamily: fonts.bold, fontSize: 13.5, lineHeight: 18, color: colors.text },
  sunMainGold: { color: colors.goldInk },
  sunTime: { fontFamily: fonts.extrabold, color: colors.sun, ...tabularNums },
  sunSub: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, color: colors.muted },
  card: {
    alignSelf: 'stretch',
    marginTop: 14,
    marginHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(227,154,75,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(227,154,75,0.45)',
  },
  cardText: { flex: 1, gap: 3 },
  cardTitle: { fontFamily: fonts.extrabold, fontSize: 14, color: colors.warn },
  cardBody: { fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 17, color: colors.text },
  cardBtn: {
    alignSelf: 'flex-start',
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.gold,
  },
  cardBtnText: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.goldInk },
});

