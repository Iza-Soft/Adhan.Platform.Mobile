import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { GeometricPattern } from '@/components/GeometricPattern';
import { ChevronIcon } from '@/components/icons';
import { PlayButton } from '@/components/sounds/PlayButton';
import { Toast } from '@/components/Toast';
import { PRAYER_IDS, type PrayerId } from '@/domain/prayers';
import {
  BUILTIN_SOUNDS,
  customToDef,
  DEFAULT_FULL,
  DEFAULT_NOTIFY,
  DEFAULT_SHORT,
  findSound,
  fitsUse,
  formatDuration,
  type SoundDef,
  type SoundKind,
  type SoundUse,
} from '@/domain/sounds';
import { useI18n } from '@/i18n';
import { addCustomSound, removeCustomSound, stopPreview } from '@/services/sounds';
import { useSounds } from '@/store/sounds';
import { colors } from '@/theme/colors';
import { fonts, tabularNums } from '@/theme/typography';

/**
 * Изборът на звук (етап 6) – за една молитва (`?p=asr`) или за известията (`?p=notify`).
 * Android: пълен звук за алармата (вградени + свои + „Добави свой звук“) и кратък резервен.
 * iPhone: само кратки звуци до 30 сек. (вградени + свои + „Добави свой звук“).
 */
export default function SoundScreen() {
  const insets = useSafeAreaInsets();
  const { lang, t } = useI18n();
  const s = t.sounds;
  const { p } = useLocalSearchParams<{ p?: string }>();
  const prayer = PRAYER_IDS.includes(p as PrayerId) ? (p as PrayerId) : null;
  const store = useSounds();
  const android = Platform.OS === 'android';
  const [busy, setBusy] = useState(false);
  /** Файлът е избран и се обработва – показва се индикатор над целия екран. */
  const [working, setWorking] = useState<{ kind: SoundKind; name: string; use: SoundUse } | null>(null);
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const toastId = useRef(0);
  const say = (text: string) => setToast({ id: ++toastId.current, text });

  // при излизане от екрана преслушването спира
  useEffect(() => stopPreview, []);

  const closing = useRef(false);
  const back = () => {
    if (closing.current) return;
    closing.current = true;
    if (router.canGoBack()) router.back();
    else router.replace('/settings');
  };

  // известията – само звънове; алармата – езан, текбири и своите звуци (без звъновете)
  const builtin = (kind: SoundKind, use: SoundUse = 'alarm') =>
    BUILTIN_SOUNDS.filter((x) => x.kind === kind && fitsUse(x, use));
  const custom = (kind: SoundKind, use: SoundUse = 'alarm') =>
    store.custom.filter((c) => c.kind === kind && (c.use ?? 'alarm') === use).map(customToDef);

  const selected = (kind: SoundKind): string => {
    if (!prayer) return findSound(store.notify, 'short', store.custom, 'notify').id;
    return findSound(kind === 'full' ? store.full[prayer] : store.short[prayer], kind, store.custom).id;
  };
  const choose = (kind: SoundKind, id: string) => {
    if (!prayer) store.setNotify(id);
    else store.setSound(kind, prayer, id);
  };

  const add = async (kind: SoundKind, use: SoundUse = 'alarm') => {
    setBusy(true);
    const r = await addCustomSound(kind, (name) => setWorking({ kind, name, use }), use);
    setWorking(null);
    setBusy(false);
    if (r.ok) {
      choose(kind, r.sound.id);
      say(
        r.sound.originalSec
          ? s.addedTrimmed(r.sound.name, formatDuration(r.sound.durationSec))
          : s.added(r.sound.name),
      );
      return;
    }
    if (r.reason === 'canceled') return;
    const name = r.name ?? '';
    say(
      r.reason === 'tooLong'
        ? use === 'notify'
          ? s.tooLongNotify(name, formatDuration(r.durationSec ?? 0))
          : s.tooLongFull(name)
        : r.reason === 'tooBig'
          ? s.tooBig
          : r.reason === 'unsupported'
            ? s.unsupported
            : s.unreadable,
    );
  };

  const remove = (sound: SoundDef) => {
    const c = store.custom.find((x) => x.id === sound.id);
    if (!c) return;
    Alert.alert(s.deleteTitle(c.name), s.deleteText, [
      { text: s.cancel, style: 'cancel' },
      { text: s.delete, style: 'destructive', onPress: () => removeCustomSound(c) },
    ]);
  };

  const list = (kind: SoundKind, all: SoundDef[], defaultId: string, addKind?: SoundKind, addUse: SoundUse = 'alarm') => {
    const sel = selected(kind);
    // звукът по подразбиране – най-отгоре
    const items = [...all.filter((x) => x.id === defaultId), ...all.filter((x) => x.id !== defaultId)];
    return (
      <View style={styles.card}>
        {items.map((x, i) => {
          const on = x.id === sel;
          return (
            <Pressable
              key={x.id}
              onPress={() => choose(kind, x.id)}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              style={({ pressed }) => [styles.row, i > 0 && styles.border, pressed && styles.pressed]}
            >
              <View style={[styles.radio, on && styles.radioOn]}>{on && <View style={styles.dot} />}</View>
              <View style={styles.text}>
                <Text style={[styles.name, on && styles.nameOn]} numberOfLines={2}>
                  {x.names[lang]}
                  {x.custom ? <Text style={styles.mine}>{`  ${s.mine}`}</Text> : null}
                </Text>
                {x.id === defaultId && <Text style={styles.byDefault}>{s.byDefault}</Text>}
                {x.originalSec ? (
                  <Text style={styles.hint}>{s.trimmed(formatDuration(x.durationSec), formatDuration(x.originalSec))}</Text>
                ) : null}
              </View>
              {x.durationSec > 0 && <Text style={styles.dur}>{formatDuration(x.durationSec)}</Text>}
              {!(x.id === 'system' && Platform.OS === 'ios') && <PlayButton sound={x} />}
              {x.custom && (
                <Pressable onPress={() => remove(x)} hitSlop={8} accessibilityRole="button" accessibilityLabel={s.delete}>
                  <Text style={styles.del}>✕</Text>
                </Pressable>
              )}
            </Pressable>
          );
        })}
        {addKind && (
          <Pressable
            onPress={() => add(addKind, addUse)}
            disabled={busy}
            accessibilityRole="button"
            style={({ pressed }) => [styles.row, items.length > 0 && styles.border, pressed && styles.pressed]}
          >
            {busy ? (
              <ActivityIndicator size="small" color={colors.gold} style={styles.plusBox} />
            ) : (
              <View style={styles.plusBox}>
                <Svg width={20} height={20} viewBox="0 0 20 20">
                  <Path d="M10 5v10M5 10h10" stroke={colors.gold} strokeWidth={2} strokeLinecap="round" />
                </Svg>
              </View>
            )}
            <View style={styles.text}>
              <Text style={styles.addText}>{busy ? s.adding : s.add}</Text>
              <Text style={styles.hint}>
                {addUse === 'notify' ? s.addNotifyHint : addKind === 'full' ? s.addFullHint : s.addShortHint}
              </Text>
            </View>
          </Pressable>
        )}
      </View>
    );
  };

  const section = (title: string, hint: string) => (
    <View style={styles.sectionHead}>
      <Text style={styles.sectionLabel}>{title.toUpperCase()}</Text>
      <Text style={styles.sectionHint}>{hint}</Text>
    </View>
  );

  const title = prayer ? s.title(t.prayers[prayer]) : s.notifyTitle;

  return (
    <View style={styles.root}>
      <GeometricPattern />
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={back} hitSlop={10} accessibilityRole="button" style={styles.backBtn}>
          <ChevronIcon direction="left" size={18} color={colors.gold} />
          <Text style={styles.backText}>{t.settings.title}</Text>
        </Pressable>
      </View>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>{title}</Text>

        {!prayer ? (
          <>
            {section(s.notifyGroup, s.notifyHint)}
            {list('short', [...builtin('short', 'notify'), ...custom('short', 'notify')], DEFAULT_NOTIFY, 'short', 'notify')}
          </>
        ) : android ? (
          <>
            {section(s.fullSection, s.fullHint)}
            {list('full', [...builtin('full'), ...custom('full')], DEFAULT_FULL, 'full')}
            {section(s.shortSection, s.shortHintAndroid)}
            {list('short', [...builtin('short'), ...custom('short')], DEFAULT_SHORT, 'short')}
          </>
        ) : (
          <>
            {section(s.iosSection, s.iosHint)}
            {list('short', [...builtin('short'), ...custom('short')], DEFAULT_SHORT, 'short')}
          </>
        )}

        {prayer && (
          <Pressable
            onPress={() => {
              store.applyToAll(prayer);
              say(s.applied);
            }}
            accessibilityRole="button"
            style={({ pressed }) => [styles.applyAll, pressed && styles.pressed]}
          >
            <Text style={styles.applyText}>{s.applyAll}</Text>
            <Text style={styles.applyLink}>{s.apply}</Text>
          </Pressable>
        )}
        {prayer && Platform.OS === 'ios' && <Text style={styles.footnote}>{s.iosFuture}</Text>}
      </ScrollView>
      {working && (
        <View style={styles.overlay} accessibilityLiveRegion="polite">
          <View style={styles.overlayCard}>
            <ActivityIndicator size="large" color={colors.gold} />
            <Text style={styles.overlayTitle}>{working.kind === 'short' && working.use === 'alarm' ? s.workingShort : s.workingFull}</Text>
            <Text style={styles.overlayName} numberOfLines={2}>
              {working.name}
            </Text>
            {working.kind === 'short' && working.use === 'alarm' && <Text style={styles.overlayHint}>{s.workingHint}</Text>}
          </View>
        </View>
      )}
      <Toast message={toast} bottom={insets.bottom + 24} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.base },
  header: { paddingHorizontal: 16, paddingBottom: 4 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, alignSelf: 'flex-start' },
  backText: { fontFamily: fonts.bold, fontSize: 15, color: colors.gold },
  content: { paddingHorizontal: 16, gap: 8 },
  title: { fontFamily: fonts.extrabold, fontSize: 26, color: colors.text, marginTop: 4, marginBottom: 4 },
  sectionHead: { marginTop: 10, paddingHorizontal: 6, gap: 2 },
  sectionLabel: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1.1, color: colors.muted },
  sectionHint: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, color: colors.muted },
  card: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 18,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 14, paddingRight: 10, paddingVertical: 9, minHeight: 54 },
  border: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.10)' },
  pressed: { opacity: 0.7 },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'rgba(242,239,232,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { borderColor: colors.gold },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.gold },
  text: { flex: 1, gap: 1 },
  name: { fontFamily: fonts.semibold, fontSize: 14.5, color: colors.text },
  nameOn: { color: colors.gold },
  mine: { fontFamily: fonts.extrabold, fontSize: 10, color: colors.muted },
  byDefault: { fontFamily: fonts.semibold, fontSize: 11.5, color: '#B8955A' },
  dur: { fontFamily: fonts.medium, fontSize: 12, color: colors.muted, ...tabularNums },
  del: { fontSize: 15, color: colors.muted, paddingHorizontal: 2 },
  plusBox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addText: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.gold },
  hint: { fontFamily: fonts.regular, fontSize: 11.5, color: colors.muted },
  applyAll: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  applyText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text, flex: 1 },
  applyLink: { fontFamily: fonts.bold, fontSize: 14, color: colors.gold },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(6,10,20,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  overlayCard: {
    alignSelf: 'stretch',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 26,
    paddingHorizontal: 20,
    borderRadius: 22,
    backgroundColor: '#16243A',
    borderWidth: 1,
    borderColor: 'rgba(212,168,87,0.35)',
  },
  overlayTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.text, textAlign: 'center', marginTop: 4 },
  overlayName: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.gold, textAlign: 'center' },
  overlayHint: { fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 17, color: colors.muted, textAlign: 'center' },
  footnote: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.muted, marginTop: 8, paddingHorizontal: 6 },
});
