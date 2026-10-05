import * as Clipboard from 'expo-clipboard';
import * as Location from 'expo-location';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  FlatList,
  Linking,
  Pressable,
  Share,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ArrowUpIcon, ChevronIcon, CopyIcon, LocateIcon, MosqueIcon, NavigateIcon, PinIcon, ShareIcon } from '@/components/icons';
import { MosqueMap } from '@/components/mosques/MosqueMap';
import { navAppName } from '@/components/mosques/navLabel';
import { NavSheet } from '@/components/mosques/NavSheet';
import { useTabBarHeight } from '@/components/TabBar';
import { Toast } from '@/components/Toast';
import { formatHM } from '@/domain/format';
import { FAR_RADIUS_M, formatDistance, NEAR_RADIUS_M, nearMosques, type NearMosque } from '@/domain/mosques';
import type { NavAppId } from '@/domain/navApps';
import { PRAYERS } from '@/domain/prayers';
import { useNow } from '@/hooks/useNow';
import { usePrayerSchedule } from '@/hooks/usePrayerSchedule';
import { useI18n, type Lang, type Strings } from '@/i18n';
import { currentPosition } from '@/services/location';
import { cachedMosques, loadMosques, MosquesFetchError, type MosquesError, type MosquesResult } from '@/services/mosques';
import { openDirections, placeLink } from '@/services/navigation';
import { selectLocation, useSettings } from '@/store/settings';
import { colors } from '@/theme/colors';
import { fonts, tabularNums } from '@/theme/typography';

/** Листът със списъка застъпва картата с толкова (заоблените ъгли). */
const OVERLAP = 28;

type Origin = { lat: number; lon: number; gps: boolean };
type Phase = 'locating' | 'loading' | 'done' | 'error';

/**
 * „Джамии наблизо“ (етап 12): карта отгоре, списък по разстояние отдолу, следващата молитва.
 * Докосване на джамия → детайли с „Упътване“ в избраното приложение за навигация.
 * Позицията се взима наново при всяко отваряне на екрана (без фоново следене).
 */
export default function MosquesScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useTabBarHeight();
  const { lang, t, pick } = useI18n();
  const m = t.mosques;
  const { height: winH } = useWindowDimensions();
  const mapH = Math.round(Math.min(Math.max(winH * 0.44, 280), 440));

  const location = useSettings(selectLocation);
  const autoLocation = useSettings((s) => s.autoLocation);
  const navApp = useSettings((s) => s.navApp);
  const navRemembered = useSettings((s) => s.navRemembered);
  const setNavApp = useSettings((s) => s.setNavApp);
  const forgetNavApp = useSettings((s) => s.forgetNavApp);

  const [origin, setOrigin] = useState<Origin | null>(null);
  const [noGps, setNoGps] = useState<'denied' | 'unavailable' | null>(null);
  const [radius, setRadius] = useState(NEAR_RADIUS_M);
  const [result, setResult] = useState<MosquesResult | null>(null);
  const [phase, setPhase] = useState<Phase>('locating');
  const [error, setError] = useState<MosquesError | null>(null);
  const [reload, setReload] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [recenter, setRecenter] = useState(0);
  const [sheet, setSheet] = useState<{ missing: NavAppId | null } | null>(null);
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const toastId = useRef(0);
  const say = (text: string) => setToast({ id: ++toastId.current, text });

  const applyPosition = (p: Awaited<ReturnType<typeof currentPosition>>) => {
    if (p.ok) {
      setOrigin({ lat: p.latitude, lon: p.longitude, gps: true });
      setNoGps(null);
    } else {
      // без GPS – около избраното място за часовете
      const { latitude, longitude } = useSettings.getState().gpsLocation ?? useSettings.getState().manualLocation ?? location;
      setOrigin({ lat: latitude, lon: longitude, gps: false });
      setNoGps(p.reason);
    }
    setRecenter((x) => x + 1);
  };
  const locate = () => {
    setPhase('locating');
    currentPosition().then(applyPosition);
  };

  // позицията – при отваряне на раздела
  useEffect(() => {
    currentPosition().then(applyPosition);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!origin) return;
    let live = true;
    const force = reload > 0;
    (async () => {
      // последното търсене – веднага, докато дойде новото
      const cached = await cachedMosques(origin.lat, origin.lon, radius, lang);
      if (!live) return;
      if (cached) setResult(cached);
      setPhase('loading');
      try {
        const r = await loadMosques(origin.lat, origin.lon, radius, lang, force);
        if (!live) return;
        setResult(r);
        setError(null);
        setPhase('done');
      } catch (e) {
        if (!live) return;
        setError(e instanceof MosquesFetchError ? e.reason : 'offline');
        setPhase('error');
      }
    })();
    return () => {
      live = false;
    };
  }, [origin, radius, lang, reload]);

  const list = result && origin ? nearMosques(result.mosques, origin.lat, origin.lon, radius) : [];
  const selected = list.find((x) => x.id === selectedId) ?? null;
  const noneNear = radius === FAR_RADIUS_M && !list.some((x) => x.distanceM <= NEAR_RADIUS_M);

  // Android „Назад“: от детайлите – към списъка
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        if (!selectedId) return false;
        setSelectedId(null);
        return true;
      });
      return () => sub.remove();
    }, [selectedId]),
  );

  // следващата молитва (без изгрева – не е молитва в джамията)
  const now = useNow(15_000);
  const schedule = usePrayerSchedule(now);
  const next = schedule.next.id === 'sunrise' ? (schedule.today.find((p) => p.id === 'dhuhr') ?? schedule.next) : schedule.next;
  const leftMin = Math.max(0, Math.floor((next.time.getTime() - now.getTime()) / 60_000));
  const leftText = `${Math.floor(leftMin / 60)}:${String(leftMin % 60).padStart(2, '0')}`;

  const name = (x: NearMosque) => x.name ?? m.unnamed;
  const timeText = (x: NearMosque) => (x.mode === 'walk' ? m.walk(x.minutes) : m.drive(x.minutes));
  const placeLabel = origin && !origin.gps ? pick(location.names) : autoLocation ? pick(location.names) : m.myLocation;

  const destination = (x: NearMosque) => ({ lat: x.lat, lon: x.lon, name: name(x) });
  const from = origin?.gps ? { lat: origin.lat, lon: origin.lon, name: m.myLocation } : null;

  const directions = async () => {
    if (!selected) return;
    if (!navRemembered) {
      setSheet({ missing: null });
      return;
    }
    const r = await openDirections(navApp, destination(selected), selected.mode, from);
    if (r === 'missing') {
      // избраното приложение е изтрито – питаме отново
      forgetNavApp();
      setSheet({ missing: navApp });
    }
  };

  const pickApp = async (id: NavAppId, remember: boolean) => {
    setSheet(null);
    if (!selected) return;
    if (remember) setNavApp(id);
    const r = await openDirections(id, destination(selected), selected.mode, from);
    if (r === 'missing') {
      if (remember) forgetNavApp();
      setSheet({ missing: id });
    }
  };

  const share = () => {
    if (!selected) return;
    const message = [name(selected), selected.address, placeLink(selected.lat, selected.lon)].filter(Boolean).join('\n');
    Share.share({ message }).catch(() => {});
  };

  const copy = async () => {
    if (!selected) return;
    const text = selected.address ?? `${selected.lat.toFixed(6)}, ${selected.lon.toFixed(6)}`;
    await Clipboard.setStringAsync(text).catch(() => {});
    say(m.copied);
  };

  const allowLocation = async () => {
    const perm = await Location.getForegroundPermissionsAsync();
    if (perm.status !== 'granted' && !perm.canAskAgain) Linking.openSettings().catch(() => {});
    else locate();
  };

  const retry = () => setReload((x) => x + 1);
  const busy = phase === 'locating' || phase === 'loading';

  /* ---------------- листът: списък ---------------- */

  const header = (
    <View>
      <View style={styles.headRow}>
        <Text style={styles.title} accessibilityRole="header">
          {m.title}
        </Text>
        {busy && result ? (
          <ActivityIndicator size="small" color={colors.gold} />
        ) : result && list.length > 0 ? (
          <Text style={styles.count}>{m.count(list.length, radiusText(radius, lang))}</Text>
        ) : null}
      </View>

      <NextChip arabic={PRAYERS[next.id].arabic} label={m.nextAt(t.prayers[next.id], formatHM(next.time))} left={m.nextIn(leftText)} t={t} />

      {noGps && (
        <Banner>
          <Text style={styles.bannerText}>{m.noGps(pick(location.names))}</Text>
          {noGps === 'denied' && <SmallButton label={m.allow} onPress={allowLocation} />}
        </Banner>
      )}
      {result?.offline && (
        <Banner>
          <Text style={styles.bannerText}>
            <Text style={styles.bannerBold}>{m.offlineTitle} </Text>
            {m.offlineText(whenText(result.at, now, m))}
          </Text>
        </Banner>
      )}

      {!result && busy && (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.gold} />
          <Text style={styles.loadingText}>{phase === 'locating' ? m.locating : m.loading}</Text>
        </View>
      )}
      {!result && phase === 'error' && (
        <Card
          title={error === 'server' ? m.errorServer : m.errorOffline}
          text={error === 'server' ? m.errorServerText : m.errorOfflineText}
          action={{ label: m.retry, onPress: retry }}
        />
      )}

      {result && radius === NEAR_RADIUS_M && list.length === 0 && (
        <Card
          title={m.noneNear(radiusText(NEAR_RADIUS_M, lang))}
          text={m.noneHint}
          action={{ label: m.searchFar(radiusText(FAR_RADIUS_M, lang)), onPress: () => setRadius(FAR_RADIUS_M) }}
        />
      )}
      {result && radius === FAR_RADIUS_M && noneNear && (
        <Card
          title={list.length ? m.noneNear(radiusText(NEAR_RADIUS_M, lang)) : m.noneFar(radiusText(FAR_RADIUS_M, lang))}
          text={m.noneHint}
        />
      )}
      {result && radius === FAR_RADIUS_M && noneNear && list.length > 0 && (
        <Text style={styles.section}>{m.within(radiusText(FAR_RADIUS_M, lang)).toUpperCase()}</Text>
      )}
    </View>
  );

  const footer =
    result && radius === NEAR_RADIUS_M && list.length > 0 ? (
      <Pressable
        onPress={() => setRadius(FAR_RADIUS_M)}
        accessibilityRole="button"
        style={({ pressed }) => [styles.farBtn, pressed && styles.pressed]}
      >
        <Text style={styles.farText}>{m.searchFar(radiusText(FAR_RADIUS_M, lang))}</Text>
      </Pressable>
    ) : null;

  return (
    <View style={styles.root}>
      <View style={[styles.map, { height: mapH + OVERLAP }]}>
        {origin && (
          <MosqueMap
            center={origin}
            me={origin.gps ? origin : null}
            mosques={list}
            selectedId={selectedId}
            onSelect={setSelectedId}
            recenter={recenter}
            bottomInset={OVERLAP}
            height={mapH + OVERLAP}
            attribution={m.attribution}
            label={m.a11yMap(list.length)}
          />
        )}
        <View style={[styles.mapTop, { top: insets.top + 8 }]} pointerEvents="box-none">
          {selected ? (
            <Pressable
              onPress={() => setSelectedId(null)}
              accessibilityRole="button"
              accessibilityLabel={m.back}
              style={({ pressed }) => [styles.round, pressed && styles.pressed]}
            >
              <ChevronIcon direction="left" size={20} color={colors.text} />
            </Pressable>
          ) : (
            <View style={styles.chip}>
              <PinIcon color={colors.gold} />
              <Text style={styles.chipText} numberOfLines={1}>
                {placeLabel}
              </Text>
            </View>
          )}
          <Pressable
            onPress={() => {
              setSelectedId(null);
              locate();
            }}
            accessibilityRole="button"
            accessibilityLabel={m.locate}
            style={({ pressed }) => [styles.round, pressed && styles.pressed]}
          >
            <LocateIcon color={colors.text} />
          </Pressable>
        </View>
      </View>

      <View style={[styles.sheet, { top: mapH, paddingBottom: tabBarHeight }]}>
        <View style={styles.handle} />
        {selected ? (
          <Detail
            mosque={selected}
            name={name(selected)}
            dist={formatDistance(selected.distanceM, lang)}
            time={timeText(selected)}
            nextLine={m.nextAt(t.prayers[next.id], formatHM(next.time))}
            reach={selected.minutes < leftMin ? m.reach(selected.minutes) : null}
            appLabel={navRemembered ? m.directions(navAppName(navApp, t)) : m.directionsAuto}
            appHint={navRemembered ? (navApp === 'auto' ? m.withAuto : m.withApp(navAppName(navApp, t))) : null}
            onDirections={directions}
            onShare={share}
            onCopy={copy}
            t={t}
          />
        ) : (
          <FlatList
            data={result ? list : []}
            keyExtractor={(x) => x.id}
            ListHeaderComponent={header}
            ListFooterComponent={footer}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            initialNumToRender={12}
            renderItem={({ item, index }) => (
              <MosqueRow
                name={name(item)}
                sub={[item.address ?? (item.name ? null : m.unnamedSub), timeText(item)].filter(Boolean).join(' · ')}
                dist={formatDistance(item.distanceM, lang)}
                bearing={item.bearing}
                nearest={index === 0}
                a11y={m.a11yRow(name(item), formatDistance(item.distanceM, lang), timeText(item))}
                onPress={() => setSelectedId(item.id)}
              />
            )}
          />
        )}
      </View>

      {/* монтира се при всяко отваряне – „Запомни избора“ отново е отметнато */}
      {selected && sheet && (
        <NavSheet
          visible
          title={name(selected)}
          distance={formatDistance(selected.distanceM, lang)}
          mode={selected.mode}
          missing={sheet.missing}
          onPick={pickApp}
          onClose={() => setSheet(null)}
        />
      )}
      <Toast message={toast} bottom={tabBarHeight + 16} />
    </View>
  );
}

/** „2 км“, „10 km“ – радиусът на търсенето (цяло число). */
function radiusText(r: number, lang: Lang): string {
  return `${r / 1000} ${lang === 'bg' ? 'км' : 'km'}`;
}

/** „днес, 14:20“, „вчера, 09:05“, „3.10, 18:40“. */
function whenText(at: number, now: Date, m: Strings['mosques']): string {
  const d = new Date(at);
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(now) - day(d)) / 86_400_000);
  const date = diff === 0 ? m.today : diff === 1 ? m.yesterday : `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')}`;
  return `${date}, ${formatHM(d)}`;
}

function NextChip({ arabic, label, left, t }: { arabic: string; label: string; left: string; t: Strings }) {
  return (
    <View style={styles.next} accessible accessibilityLabel={`${t.mosques.next} ${label}, ${left}`}>
      <Text style={styles.nextArabic}>{arabic}</Text>
      <Text style={styles.nextText} numberOfLines={1}>
        {t.mosques.next} <Text style={styles.nextBold}>{label}</Text>
      </Text>
      <Text style={styles.nextLeft}>{left}</Text>
    </View>
  );
}

function MosqueRow({
  name,
  sub,
  dist,
  bearing,
  nearest,
  a11y,
  onPress,
}: {
  name: string;
  sub: string;
  dist: string;
  bearing: number;
  nearest: boolean;
  a11y: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={[styles.badge, nearest && styles.badgeNear]}>
        <MosqueIcon size={18} strokeWidth={2} color={nearest ? colors.goldInk : colors.gold} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowName} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.rowSub} numberOfLines={1}>
          {sub}
        </Text>
      </View>
      <View style={styles.rowEnd}>
        <View style={{ transform: [{ rotate: `${Math.round(bearing)}deg` }] }}>
          <ArrowUpIcon color={colors.gold} />
        </View>
        <Text style={styles.rowDist}>{dist}</Text>
      </View>
    </Pressable>
  );
}

function Detail({
  mosque,
  name,
  dist,
  time,
  nextLine,
  reach,
  appLabel,
  appHint,
  onDirections,
  onShare,
  onCopy,
  t,
}: {
  mosque: NearMosque;
  name: string;
  dist: string;
  time: string;
  nextLine: string;
  reach: string | null;
  appLabel: string;
  appHint: string | null;
  onDirections: () => void;
  onShare: () => void;
  onCopy: () => void;
  t: Strings;
}) {
  const m = t.mosques;
  return (
    <View style={styles.detail}>
      <View style={styles.detailHead}>
        <View style={styles.detailNames}>
          <Text style={styles.detailName} accessibilityRole="header">
            {name}
          </Text>
          {mosque.arabic && (
            <Text style={styles.detailArabic} importantForAccessibility="no" accessibilityElementsHidden>
              {mosque.arabic}
            </Text>
          )}
        </View>
        <View style={styles.detailDist}>
          <Text style={styles.detailDistBig}>{dist}</Text>
          <Text style={styles.detailDistSub}>{time}</Text>
        </View>
      </View>

      <View style={styles.infoBox}>
        <View style={styles.infoRow}>
          <PinIcon color={colors.muted} />
          <Text style={[styles.infoText, !mosque.address && styles.infoMuted]}>{mosque.address ?? m.noAddress}</Text>
        </View>
        <View style={[styles.infoRow, styles.infoBorder]}>
          <Text style={styles.infoText}>
            {m.next} <Text style={styles.infoBold}>{nextLine}</Text>
            {reach ? ` – ${reach}` : ''}
          </Text>
        </View>
      </View>

      <Pressable onPress={onDirections} accessibilityRole="button" style={({ pressed }) => [styles.go, pressed && styles.goPressed]}>
        <NavigateIcon color={colors.goldInk} />
        <Text style={styles.goText}>{appLabel}</Text>
      </Pressable>
      {appHint && <Text style={styles.goHint}>{appHint}</Text>}

      <View style={styles.actions}>
        <Pressable onPress={onShare} accessibilityRole="button" style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
          <ShareIcon color={colors.text} />
          <Text style={styles.actionText}>{m.share}</Text>
        </Pressable>
        <Pressable onPress={onCopy} accessibilityRole="button" style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
          <CopyIcon color={colors.text} />
          <Text style={styles.actionText}>{mosque.address ? m.copyAddress : m.copyCoords}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Banner({ children }: { children: React.ReactNode }) {
  return <View style={styles.banner}>{children}</View>;
}

function SmallButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.smallBtn, pressed && styles.pressed]}>
      <Text style={styles.smallBtnText}>{label}</Text>
    </Pressable>
  );
}

function Card({ title, text, action }: { title: string; text: string; action?: { label: string; onPress: () => void } }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardText}>{text}</Text>
      {action && (
        <Pressable onPress={action.onPress} accessibilityRole="button" style={({ pressed }) => [styles.cardBtn, pressed && styles.pressed]}>
          <Text style={styles.cardBtnText}>{action.label}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.base },
  pressed: { opacity: 0.7 },
  map: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: '#13233A', overflow: 'hidden' },
  mapTop: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  chip: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingLeft: 11,
    paddingRight: 14,
    borderRadius: 999,
    backgroundColor: 'rgba(6,10,20,0.62)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  chipText: { flexShrink: 1, fontFamily: fonts.bold, fontSize: 13, color: colors.text },
  round: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(6,10,20,0.62)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.base,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingTop: 8,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: -10 },
    elevation: 12,
  },
  handle: { width: 38, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.18)', alignSelf: 'center', marginBottom: 12 },
  listContent: { paddingHorizontal: 16, paddingBottom: 16 },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 2, paddingBottom: 10 },
  title: { fontFamily: fonts.extrabold, fontSize: 20, color: colors.text },
  count: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.muted, ...tabularNums },
  next: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(212,168,87,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212,168,87,0.35)',
    marginBottom: 8,
  },
  nextArabic: { fontFamily: fonts.arabic, fontSize: 16, lineHeight: 22, color: colors.gold },
  nextText: { flexShrink: 1, fontFamily: fonts.semibold, fontSize: 12.5, color: colors.text, ...tabularNums },
  nextBold: { fontFamily: fonts.extrabold },
  nextLeft: { marginLeft: 'auto', fontFamily: fonts.extrabold, fontSize: 12.5, color: colors.gold, ...tabularNums },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(227,154,75,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(227,154,75,0.4)',
    marginBottom: 8,
  },
  bannerText: { flex: 1, fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 17, color: colors.text },
  bannerBold: { fontFamily: fonts.extrabold, color: colors.warn },
  smallBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.gold },
  smallBtnText: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.goldInk },
  loading: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 18, paddingHorizontal: 4 },
  loadingText: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.muted },
  card: {
    marginTop: 4,
    marginBottom: 8,
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: 4,
  },
  cardTitle: { fontFamily: fonts.extrabold, fontSize: 15, color: colors.text },
  cardText: { fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 18, color: colors.muted },
  cardBtn: { alignSelf: 'flex-start', marginTop: 8, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.gold },
  cardBtnText: { fontFamily: fonts.bold, fontSize: 13, color: colors.goldInk },
  section: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1.1, color: colors.muted, marginTop: 6, paddingHorizontal: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 60,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  badge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(212,168,87,0.14)',
  },
  badgeNear: { backgroundColor: colors.gold },
  rowText: { flex: 1, minWidth: 0 },
  rowName: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  rowSub: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 1, ...tabularNums },
  rowEnd: { alignItems: 'flex-end', gap: 2 },
  rowDist: { fontFamily: fonts.extrabold, fontSize: 13, color: colors.text, ...tabularNums },
  farBtn: {
    marginTop: 12,
    alignSelf: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(212,168,87,0.6)',
  },
  farText: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.gold },
  detail: { paddingHorizontal: 20, paddingTop: 4 },
  detailHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  detailNames: { flex: 1 },
  detailName: { fontFamily: fonts.extrabold, fontSize: 24, lineHeight: 30, color: colors.text },
  detailArabic: { fontFamily: fonts.arabic, fontSize: 20, lineHeight: 30, color: colors.gold, textAlign: 'left' },
  detailDist: { alignItems: 'flex-end' },
  detailDistBig: { fontFamily: fonts.extrabold, fontSize: 22, color: colors.text, ...tabularNums },
  detailDistSub: { fontFamily: fonts.semibold, fontSize: 12, color: colors.muted, ...tabularNums },
  infoBox: {
    marginTop: 14,
    borderRadius: 14,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 11 },
  infoBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.10)' },
  infoText: { flex: 1, fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, color: colors.text, ...tabularNums },
  infoMuted: { color: colors.muted },
  infoBold: { fontFamily: fonts.extrabold },
  go: {
    marginTop: 16,
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.gold,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  goPressed: { opacity: 0.85 },
  goText: { fontFamily: fonts.extrabold, fontSize: 16, color: colors.goldInk },
  goHint: { fontFamily: fonts.medium, fontSize: 12, color: colors.muted, textAlign: 'center', marginTop: 8 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  action: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  actionText: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.text },
});
