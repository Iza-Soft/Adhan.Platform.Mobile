import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getAlarmHistory, getAlarms, openFullScreenIntentSettings } from '../../modules/adhan-native';

import { GeometricPattern } from '@/components/GeometricPattern';
import { AlertIcon, ChevronDownIcon, ChevronIcon } from '@/components/icons';
import { formatGregorianShort, formatHM } from '@/domain/format';
import type { SoundKind } from '@/domain/notifications';
import { useI18n } from '@/i18n';
import {
  openExactAlarmSettings,
  refreshPermission,
  requestPermission,
  resetAllNotifications,
  sendTestNotification,
  useNotificationStatus,
} from '@/services/notifications';
import { colors } from '@/theme/colors';
import { fonts, tabularNums } from '@/theme/typography';

/* ------------------------------------------------------------------ данни */

type Kind = 'alarm' | 'notification' | 'reminder' | 'other';

interface Snapshot {
  /** Кога са прочетени данните – показва се под заглавието. */
  loadedAt: Date;
  channels: Notifications.NotificationChannel[];
  upcoming: { id: string; at: Date; title: string; kind: Kind }[];
  recent: { id: string; planned: Date | null; shown: Date; title: string }[];
}

const pad = (n: number) => String(n).padStart(2, '0');
const hms = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
const USAGE: Record<number, string> = { 4: 'alarm', 5: 'notification' };

const atOf = (data: unknown) => {
  const at = (data as { at?: number } | null)?.at;
  return typeof at === 'number' ? new Date(at) : null;
};

/** Видът на известието по канала му (Android) или по данните (iPhone). */
function kindOf(r: Notifications.NotificationRequest): Kind {
  const channel = (r.trigger as { channelId?: string } | null)?.channelId ?? '';
  const data = r.content.data as { kind?: string; sound?: string } | null;
  if (channel.startsWith('adhan') || data?.sound === 'adhan') return 'alarm';
  if (channel.startsWith('reminder') || data?.kind === 'reminder' || data?.kind === 'refresh' || data?.kind === 'holiday') return 'reminder';
  if (channel.startsWith('prayer') || data?.kind === 'prayer') return 'notification';
  return 'other';
}

async function fetchSnapshot(): Promise<Snapshot> {
  if (Platform.OS === 'web') return { loadedAt: new Date(), channels: [], upcoming: [], recent: [] };
  await refreshPermission();
  const [channels, scheduled, presented] = await Promise.all([
    Platform.OS === 'android' ? Notifications.getNotificationChannelsAsync() : Promise.resolve([]),
    Notifications.getAllScheduledNotificationsAsync(),
    Notifications.getPresentedNotificationsAsync(),
  ]);
  // Android, етап 5: алармите с езана са в native частта, не в expo-notifications
  const now = Date.now();
  const alarms = getAlarms()
    .filter((a) => a.at > now)
    .map((a) => ({ id: a.id, at: new Date(a.at), title: a.notifTitle, kind: 'alarm' as Kind }));
  const fired = getAlarmHistory().map((h) => ({
    id: `alarm-${h.id}-${h.fired}`,
    planned: new Date(h.planned),
    shown: new Date(h.fired),
    title: h.title,
  }));
  return {
    loadedAt: new Date(),
    channels: channels.filter((c) => !c.id.startsWith('expo_')),
    upcoming: scheduled
      .map((r) => ({ id: r.identifier, at: atOf(r.content.data) ?? new Date(0), title: r.content.title ?? '', kind: kindOf(r) }))
      .concat(alarms)
      .sort((a, b) => a.at.getTime() - b.at.getTime()),
    recent: presented
      .map((n) => ({
        id: n.request.identifier,
        planned: atOf(n.request.content.data),
        shown: new Date(n.date),
        title: n.request.content.title ?? '',
      }))
      .concat(fired)
      .sort((a, b) => b.shown.getTime() - a.shown.getTime()),
  };
}

/* ------------------------------------------------------------------ екран */

/**
 * „Проверка на известията“ (Настройки → Известия):
 * състояние с отметки, пробно известие, последните показани (със закъснението),
 * следващите планирани и – сгънати – техническите данни.
 */
export default function DiagnosticsScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const d = t.notifications.diag;
  const status = useNotificationStatus();
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [techOpen, setTechOpen] = useState(false);
  const [test, setTest] = useState<{ sound: SoundKind; at: number } | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const [refreshing, setRefreshing] = useState(false);
  const [resetDone, setResetDone] = useState(false);
  const load = useCallback(() => fetchSnapshot().then(setSnap), []);

  // „Обнови“: чете наново от телефона; индикаторът стои поне 0,6 сек., за да се забележи
  const refresh = async () => {
    setRefreshing(true);
    await Promise.all([load(), new Promise((r) => setTimeout(r, 600))]);
    setRefreshing(false);
  };

  useEffect(() => {
    let alive = true;
    fetchSnapshot().then((x) => alive && setSnap(x));
    return () => {
      alive = false;
    };
  }, []);

  // обратно броене на пробното известие; след него – обновяване, за да се види в „Последни“
  useEffect(() => {
    if (!test) return;
    const timer = setInterval(() => {
      const t2 = Date.now();
      setNow(t2);
      if (t2 >= test.at + 1500) {
        setTest(null);
        load();
      }
    }, 500);
    return () => clearInterval(timer);
  }, [test, load]);

  const closing = useRef(false);
  const back = () => {
    if (closing.current) return;
    closing.current = true;
    if (router.canGoBack()) router.back();
    else router.replace('/settings');
  };

  const sendTest = async (sound: SoundKind) => {
    const at = await sendTestNotification();
    setNow(at - 10_000);
    setTest({ sound, at });
  };

  const reset = async () => {
    setBusy(true);
    setResetDone(false);
    await resetAllNotifications();
    await load();
    setBusy(false);
    setResetDone(true);
  };

  const granted = status.permission === 'granted';
  const kindLabel: Record<Kind, string> = {
    alarm: d.kindAlarm,
    notification: d.kindNotification,
    reminder: d.kindReminder,
    other: d.kindOther,
  };
  const until = status.until ? `${formatGregorianShort(status.until, t.date)}, ${formatHM(status.until)}` : '';
  const device =
    Platform.OS === 'android'
      ? `${Platform.constants.Manufacturer} ${Platform.constants.Model} · Android ${Platform.constants.Release} (API ${Platform.Version})`
      : `${Platform.OS} ${Platform.Version}`;

  const testButton = (sound: SoundKind, label: string) => {
    const active = test?.sound === sound;
    const left = active ? Math.max(0, Math.ceil((test.at - now) / 1000)) : 0;
    return (
      <Pressable
        onPress={() => sendTest(sound)}
        disabled={!!test || !granted}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.testBtn,
          sound === 'adhan' && styles.testBtnGold,
          (!!test && !active) || !granted ? styles.disabled : null,
          pressed && styles.pressed,
        ]}
      >
        <AlertIcon mode={sound === 'adhan' ? 'adhan' : 'notify'} size={20} color={sound === 'adhan' ? colors.goldInk : colors.text} />
        <Text style={[styles.testLabel, sound === 'adhan' && styles.testLabelGold]}>{label}</Text>
        {active && <Text style={[styles.testIn, sound === 'adhan' && styles.testLabelGold]}>{d.testIn(left)}</Text>}
      </Pressable>
    );
  };

  return (
    <View style={styles.root}>
      <GeometricPattern />
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={back} hitSlop={10} accessibilityRole="button" style={styles.backBtn}>
          <ChevronIcon direction="left" size={18} color={colors.gold} />
          <Text style={styles.link}>{t.settings.title}</Text>
        </Pressable>
        <Pressable onPress={refresh} disabled={refreshing} hitSlop={10} accessibilityRole="button" style={styles.refreshBtn}>
          {refreshing ? <ActivityIndicator size="small" color={colors.gold} /> : <Text style={styles.link}>{d.refresh}</Text>}
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
        <View style={styles.titleBox}>
          <Text style={styles.title}>{d.title}</Text>
          <Text style={styles.subtitle}>{d.subtitle}</Text>
          {snap && <Text style={styles.updated}>{d.updated(hms(snap.loadedAt))}</Text>}
        </View>

        {/* ---- Състояние ---- */}
        <Section label={d.status}>
          <Check
            ok={granted}
            text={granted ? d.permOk : d.permBad}
            action={granted ? undefined : { label: d.allow, onPress: requestPermission }}
            first
          />
          {status.exact !== null && (
            <Check
              ok={status.exact}
              text={status.exact ? d.exactOk : d.exactBad}
              action={status.exact ? undefined : { label: d.allow, onPress: openExactAlarmSettings }}
            />
          )}
          {granted && status.fullScreen !== null && (
            <Check
              ok={status.fullScreen}
              text={status.fullScreen ? d.fullScreenOk : d.fullScreenBad}
              action={status.fullScreen ? undefined : { label: d.allow, onPress: openFullScreenIntentSettings }}
            />
          )}
          {granted && status.battery !== null && (
            <Check
              ok={status.battery}
              text={status.battery ? d.batteryOk : d.batteryBad}
              action={status.battery ? undefined : { label: d.fix, onPress: () => router.push('/battery') }}
            />
          )}
          <Check ok={status.count > 0} text={status.count > 0 ? d.scheduledOk(status.count, until) : d.scheduledNone} />
        </Section>

        {/* ---- Пробно известие ---- */}
        <Section label={d.test}>
          <View style={styles.testBox}>
            <View style={styles.testRow}>
              {testButton('chime', d.testNotification)}
            </View>
            <Text style={styles.small}>{d.testHint}</Text>
          </View>
        </Section>

        {!snap ? (
          <ActivityIndicator color={colors.gold} style={{ marginTop: 12 }} />
        ) : (
          <>
            {/* ---- Последни ---- */}
            <Section label={d.recent}>
              {snap.recent.length === 0 ? (
                <Line first>
                  <Text style={styles.small}>{d.recentNone}</Text>
                </Line>
              ) : (
                snap.recent.slice(0, 8).map((p, i) => {
                  const delay = p.planned ? Math.round((p.shown.getTime() - p.planned.getTime()) / 1000) : null;
                  const onTime = delay !== null && delay < 60;
                  return (
                    <Line key={p.id + i} first={i === 0}>
                      <View style={styles.item}>
                        <Text style={styles.itemTitle} numberOfLines={1}>
                          {p.title}
                        </Text>
                        <Text style={styles.small}>
                          {p.planned ? d.plannedShown(hms(p.planned), hms(p.shown)) : hms(p.shown)}
                        </Text>
                      </View>
                      {delay !== null && (
                        <View style={[styles.badge, onTime ? styles.badgeOk : styles.badgeWarn]}>
                          <Text style={[styles.badgeText, onTime ? styles.badgeTextOk : styles.badgeTextWarn]}>
                            {onTime ? d.onTime : d.late(delay)}
                          </Text>
                        </View>
                      )}
                    </Line>
                  );
                })
              )}
            </Section>

            {/* ---- Следващи ---- */}
            {snap.upcoming.length > 0 && (
              <Section label={d.upcoming}>
                {snap.upcoming.slice(0, 8).map((r, i) => (
                  <Line key={r.id} first={i === 0}>
                    <View style={styles.timeCol}>
                      <Text style={styles.time}>{formatHM(r.at)}</Text>
                      <Text style={styles.tiny}>{t.date.weekdaysShort[r.at.getDay()]}</Text>
                    </View>
                    <Text style={[styles.itemTitle, styles.flex]} numberOfLines={1}>
                      {r.title}
                    </Text>
                    <View style={[styles.tag, r.kind === 'alarm' && styles.tagGold]}>
                      <Text style={[styles.tagText, r.kind === 'alarm' && styles.tagTextGold]}>{kindLabel[r.kind]}</Text>
                    </View>
                  </Line>
                ))}
              </Section>
            )}

            {/* ---- Технически данни (сгънати) ---- */}
            <View style={styles.card}>
              <Pressable
                onPress={() => setTechOpen((o) => !o)}
                accessibilityRole="button"
                accessibilityState={{ expanded: techOpen }}
                style={styles.techHead}
              >
                <Text style={styles.itemTitle}>{d.tech}</Text>
                <View style={techOpen && styles.flip}>
                  <ChevronDownIcon color={colors.muted} />
                </View>
              </Pressable>
              {techOpen && (
                <View style={styles.techBody}>
                  <Text style={styles.small}>
                    {d.device}: {device}
                  </Text>
                  {snap.channels.map((c) => (
                    <Text key={c.id} style={styles.small}>
                      <Text style={styles.mono}>{c.id}</Text> –{' '}
                      {d.channelLine(
                        c.importance,
                        c.sound ?? '—',
                        c.enableVibrate,
                        USAGE[c.audioAttributes?.usage ?? -1] ?? String(c.audioAttributes?.usage ?? '—'),
                      )}
                    </Text>
                  ))}
                </View>
              )}
            </View>

            <View style={styles.resetBox}>
              <Pressable onPress={reset} disabled={busy} accessibilityRole="button" style={styles.resetBtn}>
                {busy ? <ActivityIndicator color={colors.gold} /> : <Text style={styles.link}>{d.reset}</Text>}
              </Pressable>
              <Text style={[styles.small, styles.center]}>{resetDone ? d.resetDone : d.resetHint}</Text>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

/* ------------------------------------------------------------------ части */

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label.toUpperCase()}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

function Line({ children, first }: { children: React.ReactNode; first?: boolean }) {
  return <View style={[styles.line, !first && styles.lineBorder]}>{children}</View>;
}

function Check({
  ok,
  text,
  action,
  first,
}: {
  ok: boolean;
  text: string;
  action?: { label: string; onPress: () => void };
  first?: boolean;
}) {
  return (
    <Line first={first}>
      <View style={[styles.dot, ok ? styles.dotOk : styles.dotWarn]}>
        <Text style={styles.dotText}>{ok ? '✓' : '!'}</Text>
      </View>
      <Text style={[styles.checkText, !ok && styles.checkWarn]}>{text}</Text>
      {action && (
        <Pressable onPress={action.onPress} hitSlop={8} accessibilityRole="button" style={styles.actionBtn}>
          <Text style={styles.actionText}>{action.label}</Text>
        </Pressable>
      )}
    </Line>
  );
}

const GREEN = '#5FBF8F';

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.base },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6 },
  link: { fontFamily: fonts.bold, fontSize: 15, color: colors.gold },
  content: { paddingHorizontal: 16, gap: 20 },
  titleBox: { gap: 6, marginTop: 4 },
  title: { fontFamily: fonts.extrabold, fontSize: 26, color: colors.text },
  subtitle: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.muted },

  section: { gap: 7 },
  sectionLabel: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1.1, color: colors.muted, paddingLeft: 6 },
  card: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 18,
    overflow: 'hidden',
  },
  line: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, minHeight: 52 },
  lineBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.10)' },

  dot: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  dotOk: { backgroundColor: 'rgba(95,191,143,0.18)' },
  dotWarn: { backgroundColor: colors.warn },
  dotText: { fontFamily: fonts.extrabold, fontSize: 13, color: colors.text, includeFontPadding: false },
  checkText: { flex: 1, fontFamily: fonts.semibold, fontSize: 14, lineHeight: 19, color: colors.text },
  checkWarn: { color: colors.warn },
  actionBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.gold },
  actionText: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.goldInk },

  testBox: { padding: 14, gap: 12 },
  testRow: { flexDirection: 'row', gap: 10 },
  testBtn: {
    flex: 1,
    height: 78,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  testBtnGold: { backgroundColor: colors.gold, borderColor: colors.gold },
  testLabel: { fontFamily: fonts.bold, fontSize: 14, color: colors.text },
  testLabelGold: { color: colors.goldInk },
  testIn: { fontFamily: fonts.semibold, fontSize: 11.5, color: colors.textDim, ...tabularNums },
  disabled: { opacity: 0.4 },
  pressed: { transform: [{ scale: 0.97 }] },

  item: { flex: 1, gap: 2 },
  flex: { flex: 1 },
  itemTitle: { fontFamily: fonts.bold, fontSize: 14, color: colors.text },
  small: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.muted },
  tiny: { fontFamily: fonts.medium, fontSize: 10.5, color: colors.muted },
  mono: { fontFamily: fonts.bold, color: colors.textDim },

  badge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
  badgeOk: { backgroundColor: 'rgba(95,191,143,0.16)' },
  badgeWarn: { backgroundColor: 'rgba(227,154,75,0.18)' },
  badgeText: { fontFamily: fonts.bold, fontSize: 11.5, ...tabularNums },
  badgeTextOk: { color: GREEN },
  badgeTextWarn: { color: colors.warn },

  timeCol: { width: 46, alignItems: 'flex-start' },
  time: { fontFamily: fonts.extrabold, fontSize: 15, color: colors.text, ...tabularNums },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.08)' },
  tagGold: { backgroundColor: 'rgba(212,168,87,0.18)' },
  tagText: { fontFamily: fonts.semibold, fontSize: 11, color: colors.textDim },
  tagTextGold: { color: colors.gold },

  techHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  flip: { transform: [{ rotate: '180deg' }] },
  techBody: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    gap: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.10)',
    paddingTop: 10,
  },
  resetBox: { gap: 6, alignItems: 'center' },
  resetBtn: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(212,168,87,0.45)',
  },
  center: { textAlign: 'center', paddingHorizontal: 12 },
  refreshBtn: { minWidth: 70, alignItems: 'flex-end' },
  updated: { fontFamily: fonts.medium, fontSize: 11.5, color: colors.muted, ...tabularNums },
});
