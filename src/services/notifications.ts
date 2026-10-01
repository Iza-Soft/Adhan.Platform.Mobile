import * as Notifications from 'expo-notifications';
import { Linking, Platform } from 'react-native';
import { create } from 'zustand';

import { canScheduleExactAlarms, openExactAlarmSettings } from '../../modules/adhan-native';

import { planNotifications, type PlannedNotification, type SoundKind } from '@/domain/notifications';
import { getI18n } from '@/i18n';
import { useAlertPrefs } from '@/store/alertPrefs';
import { selectLocation, selectTimesOptions, useSettings } from '@/store/settings';

/**
 * Известията за намаз – само локални (без интернет, без Firebase/FCM и без HMS Push).
 * Android планира всяко известие с AlarmManager, iPhone – с UNUserNotificationCenter.
 * Затова работят еднакво на телефони с Google услуги, на Huawei без тях и на iPhone.
 */

export type NotificationPermission = 'granted' | 'denied' | 'undetermined' | 'unavailable';

interface NotificationStatus {
  /** false, докато разрешението още не е проверено (първите мигове след стартиране). */
  checked: boolean;
  permission: NotificationPermission;
  /** Android 13+/iOS: може ли приложението пак да покаже системния въпрос. */
  canAskAgain: boolean;
  /** Android 12+: точни известия („Аларми и напомняния“); null – неприложимо. */
  exact: boolean | null;
  /** Колко известия са планирани и до кога. */
  count: number;
  until: Date | null;
}

export const useNotificationStatus = create<NotificationStatus>(() => ({
  checked: false,
  permission: Platform.OS === 'web' ? 'unavailable' : 'undetermined',
  canAskAgain: true,
  exact: null,
  count: 0,
  until: null,
}));

const SUPPORTED = Platform.OS === 'android' || Platform.OS === 'ios';

/** Файловете от assets/sounds (виж app.json → expo-notifications → sounds). */
const SOUND_FILE: Record<SoundKind, string> = {
  chime: 'ezan_chime.wav',
  adhan: 'ezan_adhan.wav',
};

/* ------------------------------------------------------------------ канали (Android) */

type ChannelKind = 'prayer' | 'adhan' | 'reminder';

/**
 * На Android звукът и вибрацията са на канала и не могат да се сменят след създаването му.
 * Затова каналите с и без вибрация са различни („adhan-v2“ / „adhan-s2“),
 * а ненужният се трие при смяна на настройката.
 * Версия 2: каналът „Езан“ звучи като аларма (виж setupChannels).
 * Версия 3: при „Езан“ вибрацията продължава, докато звучи езанът; при известията – една.
 * Каналите от по-старите версии се трият.
 */
const CHANNEL_VERSION = 3;
function channelId(kind: ChannelKind, vibrate: boolean, version = CHANNEL_VERSION): string {
  return `${kind}-${vibrate ? 'v' : 's'}${version}`;
}

/** Известие и напомняне: едно дълго вибриране (1 сек.). */
const VIBRATION_ONCE = [0, 1000];

/**
 * Езан: 1 сек. вибрация / 0,7 сек. пауза, докато звучи временният езан (~28 сек.).
 * Силата на вибрацията се определя от телефона (Настройки → Звуци и вибрация).
 * В етап 5 алармата управлява вибрацията сама – със силата и продължителността на пълния езан.
 */
const VIBRATION_ADHAN = [0, ...Array.from({ length: 16 }, () => [1000, 700]).flat()];

const vibrationFor = (kind: ChannelKind) => (kind === 'adhan' ? VIBRATION_ADHAN : VIBRATION_ONCE);

function channelFor(n: PlannedNotification): ChannelKind {
  if (n.kind === 'reminder' || n.kind === 'refresh') return 'reminder';
  return n.sound === 'adhan' ? 'adhan' : 'prayer';
}

let channelsFor: boolean | null = null;

async function setupChannels(vibrate: boolean): Promise<void> {
  if (Platform.OS !== 'android' || channelsFor === vibrate) return;
  const { t } = getI18n();
  const { AndroidAudioUsage: Usage, AndroidAudioContentType: Content, AndroidImportance: Imp } = Notifications;
  const defs: {
    kind: ChannelKind;
    name: string;
    sound: SoundKind;
    importance: Notifications.AndroidImportance;
    usage: Notifications.AndroidAudioUsage;
  }[] = [
    { kind: 'prayer', name: t.notifications.channelPrayer, sound: 'chime', importance: Imp.HIGH, usage: Usage.NOTIFICATION },
    // Езанът звучи през потока за аларми: не зависи от силата на звука за известия
    // и от безшумния режим – както будилник. (Пълният езан с „Спри“ – етап 5.)
    { kind: 'adhan', name: t.notifications.channelAdhan, sound: 'adhan', importance: Imp.MAX, usage: Usage.ALARM },
    { kind: 'reminder', name: t.notifications.channelReminder, sound: 'chime', importance: Imp.HIGH, usage: Usage.NOTIFICATION },
  ];
  for (const d of defs) {
    await Notifications.setNotificationChannelAsync(channelId(d.kind, vibrate), {
      name: d.name,
      importance: d.importance,
      sound: SOUND_FILE[d.sound],
      audioAttributes: { usage: d.usage, contentType: Content.SONIFICATION },
      enableVibrate: vibrate,
      vibrationPattern: vibrate ? vibrationFor(d.kind) : null,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
    await Notifications.deleteNotificationChannelAsync(channelId(d.kind, !vibrate));
    // каналите от по-стари версии
    for (let v = 1; v < CHANNEL_VERSION; v++) {
      await Notifications.deleteNotificationChannelAsync(channelId(d.kind, true, v));
      await Notifications.deleteNotificationChannelAsync(channelId(d.kind, false, v));
    }
  }
  channelsFor = vibrate;
}

/* ------------------------------------------------------------------ разрешение */

function toPermission(p: Notifications.NotificationPermissionsStatus): NotificationPermission {
  if (Platform.OS === 'ios') {
    const s = p.ios?.status;
    if (
      s === Notifications.IosAuthorizationStatus.AUTHORIZED ||
      s === Notifications.IosAuthorizationStatus.PROVISIONAL ||
      s === Notifications.IosAuthorizationStatus.EPHEMERAL
    ) {
      return 'granted';
    }
    return s === Notifications.IosAuthorizationStatus.DENIED ? 'denied' : 'undetermined';
  }
  if (p.granted) return 'granted';
  return p.status === 'undetermined' ? 'undetermined' : 'denied';
}

export async function refreshPermission(): Promise<NotificationPermission> {
  if (!SUPPORTED) return 'unavailable';
  const p = await Notifications.getPermissionsAsync();
  const permission = toPermission(p);
  useNotificationStatus.setState({
    checked: true,
    permission,
    canAskAgain: p.canAskAgain,
    exact: canScheduleExactAlarms(),
  });
  return permission;
}

/**
 * Пита за разрешение. Ако системата вече не показва въпроса (отказано завинаги) –
 * отваря настройките на приложението в телефона.
 */
export async function requestPermission(): Promise<NotificationPermission> {
  if (!SUPPORTED) return 'unavailable';
  const current = await Notifications.getPermissionsAsync();
  if (toPermission(current) === 'denied' && !current.canAskAgain) {
    await Linking.openSettings();
    return 'denied';
  }
  const p = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowSound: true, allowBadge: false },
  });
  const permission = toPermission(p);
  useNotificationStatus.setState({ permission, canAskAgain: p.canAskAgain });
  if (permission === 'granted') rescheduleNotifications();
  return permission;
}

export { openExactAlarmSettings };

/* ------------------------------------------------------------------ планиране */

/** Всичко, което определя едно известие. Ако се смени, известието се пренасрочва. */
function signatureOf(n: PlannedNotification, channel: string, exact: boolean | null): string {
  return `${n.at.getTime()}|${n.sound}|${channel}|${exact}|${n.title}|${n.body}`;
}

let running: Promise<void> | null = null;
let again = false;

/**
 * Привежда планираните известия в съответствие с настройките.
 * Вика се при стартиране, при връщане в приложението, при всяка промяна на мястото,
 * часовете, камбанките, напомнянето и вибрацията, и от фоновата задача.
 * Паралелните извиквания се обединяват.
 */
export function rescheduleNotifications(): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = doReschedule()
    .catch((e) => console.warn('[notifications]', e))
    .finally(() => {
      running = null;
      if (again) {
        again = false;
        rescheduleNotifications();
      }
    });
  return running;
}

async function doReschedule(): Promise<void> {
  if (!SUPPORTED) return;
  const permission = await refreshPermission();
  const exact = useNotificationStatus.getState().exact;

  const s = useSettings.getState();
  const { lang, t } = getI18n();
  const plan =
    permission === 'granted'
      ? planNotifications({
          now: new Date(),
          options: selectTimesOptions(s).options,
          modes: useAlertPrefs.getState().modes,
          reminderMinutes: s.reminderMinutes,
          placeName: selectLocation(s).names[lang],
          texts: { prayers: t.prayers, ...t.notifications },
        })
      : [];

  await setupChannels(s.vibrate);

  // Сравнява с вече планираните: трие само променените и липсващите, добавя само новите.
  const existing = await Notifications.getAllScheduledNotificationsAsync();
  const ours = new Map(
    existing
      .filter((r) => r.identifier.startsWith('ezan-'))
      .map((r) => [r.identifier, (r.content.data as { sig?: string } | null)?.sig ?? '']),
  );

  const wanted = plan.map((n) => {
    const channel = channelId(channelFor(n), s.vibrate);
    return { n, channel, sig: signatureOf(n, channel, exact) };
  });
  const wantedIds = new Set(wanted.map((w) => w.n.id));

  for (const [id, sig] of ours) {
    const w = wanted.find((x) => x.n.id === id);
    if (!wantedIds.has(id) || !w || w.sig !== sig) {
      await Notifications.cancelScheduledNotificationAsync(id);
      ours.delete(id);
    }
  }

  for (const { n, channel, sig } of wanted) {
    if (ours.has(n.id)) continue;
    await Notifications.scheduleNotificationAsync({
      identifier: n.id,
      content: {
        title: n.title,
        body: n.body,
        // на Android звукът е от канала, но без име на звук известието би било „тихо“
        sound: SOUND_FILE[n.sound],
        // за Android под 8; на по-новите вибрацията е от канала
        vibrate: s.vibrate ? vibrationFor(channelFor(n)) : undefined,
        data: { sig, kind: n.kind, prayer: n.prayer, sound: n.sound, at: n.at.getTime() },
        ...(Platform.OS === 'android' ? { color: '#D4A857' } : {}),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: n.at,
        channelId: channel,
      },
    });
  }

  useNotificationStatus.setState({
    count: plan.length,
    until: plan.length ? plan[plan.length - 1].at : null,
  });
}

/** Трие всички известия на Езан и ги планира наново (от „Проверка на известията“). */
export async function resetAllNotifications(): Promise<void> {
  if (!SUPPORTED) return;
  await running;
  const existing = await Notifications.getAllScheduledNotificationsAsync();
  for (const r of existing) {
    if (r.identifier.startsWith('ezan-')) await Notifications.cancelScheduledNotificationAsync(r.identifier);
  }
  channelsFor = null;
  await rescheduleNotifications();
}

/** Пробно известие след 10 сек. – с кратък сигнал или с езан. Връща часа, в който ще дойде. */
export async function sendTestNotification(sound: SoundKind): Promise<number> {
  const at = Date.now() + 10_000;
  if (!SUPPORTED) return at;
  const s = useSettings.getState();
  await setupChannels(s.vibrate);
  const { t } = getI18n();
  await Notifications.scheduleNotificationAsync({
    identifier: `test-${Date.now()}`,
    content: {
      title: t.notifications.testTitle,
      body: t.notifications.testBody,
      sound: SOUND_FILE[sound],
      vibrate: s.vibrate ? vibrationFor(sound === 'adhan' ? 'adhan' : 'prayer') : undefined,
      data: { kind: 'test', sound, at },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(at),
      channelId: channelId(sound === 'adhan' ? 'adhan' : 'prayer', s.vibrate),
    },
  });
  return at;
}

/** Как се показва известие, докато приложението е отворено: като обикновено, със звук. */
export function configureNotificationHandler(): void {
  if (!SUPPORTED) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}
