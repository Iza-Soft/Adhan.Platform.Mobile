import * as Notifications from 'expo-notifications';
import { Linking, Platform } from 'react-native';
import { create } from 'zustand';

import {
  canScheduleExactAlarms,
  canUseFullScreenIntent,
  createSoundChannel,
  hasNativeAlarms,
  isIgnoringBatteryOptimizations,
  openExactAlarmSettings,
  setAlarms,
  type NativeAlarm,
} from '../../modules/adhan-native';

import { NOTIFICATION_LIMIT, planHolidayReminders, planNotifications, type PlannedNotification } from '@/domain/notifications';
import { PRAYERS, type PrayerId } from '@/domain/prayers';
import { findSound, notificationFileName, type SoundDef } from '@/domain/sounds';
import { getI18n } from '@/i18n';
import { PHASE_GRADIENTS } from '@/theme/gradients';
import { useAlertPrefs } from '@/store/alertPrefs';
import { selectHolidaySource, selectLocation, selectTimesOptions, useSettings } from '@/store/settings';
import { useSounds } from '@/store/sounds';

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
  /** Колко известия са планирани и до кога (заедно с алармите). */
  count: number;
  until: Date | null;
  /** Android 14+: „Аларма на цял екран“; null – неприложимо. */
  fullScreen: boolean | null;
  /** Android: true – без ограничения на батерията; null – неприложимо. */
  battery: boolean | null;
  /** Колко аларми с езан са планирани в native частта (Android). */
  alarms: number;
}

export const useNotificationStatus = create<NotificationStatus>(() => ({
  checked: false,
  permission: Platform.OS === 'web' ? 'unavailable' : 'undetermined',
  canAskAgain: true,
  exact: null,
  count: 0,
  until: null,
  fullScreen: null,
  battery: null,
  alarms: 0,
}));

const SUPPORTED = Platform.OS === 'android' || Platform.OS === 'ios';

/* ------------------------------------------------------------------ звуци и канали (Android) */

/**
 * Етап 6: всяка молитва има свой звук. На Android звукът е на канала и не може да се
 * смени след създаването му – затова каналът е за двойката „вид + звук“ (+ с/без вибрация):
 * „ch4-n-chime_soft-v“ – известие/напомняне, „ch4-a-takbir_makkah-v“ – езанът като известие
 * (без „Аларми и напомняния“), през потока за аларми. Ненужните канали се трият.
 */
type ChannelUse = 'notify' | 'alarm';
const CHANNEL_PREFIX = 'ch4-';
/** Каналите отпреди етап 6 („prayer-v3“, „adhan-s2“…). */
const OLD_CHANNEL = /^(prayer|adhan|reminder)-[vs]\d$/;

const channelId = (use: ChannelUse, sound: SoundDef, vibrate: boolean) =>
  `${CHANNEL_PREFIX}${use === 'alarm' ? 'a' : 'n'}-${(sound.custom ? sound.id : sound.file).replace(/[^a-z0-9_]/gi, '_')}-${vibrate ? 'v' : 's'}`;

/** Известие и напомняне: едно дълго вибриране (1 сек.). */
const VIBRATION_ONCE = [0, 1000];
/** Езанът като известие (до 30 сек.): 1 сек. вибрация / 0,7 сек. пауза. */
const VIBRATION_ALARM = [0, ...Array.from({ length: 16 }, () => [1000, 700]).flat()];
const vibrationFor = (use: ChannelUse) => (use === 'alarm' ? VIBRATION_ALARM : VIBRATION_ONCE);

/** Каналите, създадени в тази сесия (създаването е бавно – не всеки път). */
const created = new Set<string>();

async function ensureChannel(use: ChannelUse, sound: SoundDef, vibrate: boolean): Promise<string> {
  const id = channelId(use, sound, vibrate);
  if (Platform.OS !== 'android' || created.has(id)) return id;
  const { t, pick } = getI18n();
  const name = `${use === 'alarm' ? t.notifications.channelAdhan : t.notifications.channelPrayer} · ${pick(sound.names)}`;
  // свой кратък звук (откъсът в Notifications/Ezan) и звукът на телефона – каналът се създава
  // в native частта, защото expo-notifications приема само звуци от res/raw
  if (sound.custom || sound.id === 'system') {
    createSoundChannel(id, name, sound.file, use === 'alarm', vibrate, vibrationFor(use));
    created.add(id);
    return id;
  }
  const { AndroidAudioUsage: Usage, AndroidAudioContentType: Content, AndroidImportance: Imp } = Notifications;
  await Notifications.setNotificationChannelAsync(id, {
    name,
    importance: use === 'alarm' ? Imp.MAX : Imp.HIGH,
    sound: notificationFileName(sound),
    // езанът – през потока за аларми: не зависи от силата на звука за известия и от безшумния режим
    audioAttributes: { usage: use === 'alarm' ? Usage.ALARM : Usage.NOTIFICATION, contentType: Content.SONIFICATION },
    enableVibrate: vibrate,
    vibrationPattern: vibrate ? vibrationFor(use) : null,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
  created.add(id);
  return id;
}

/** Трие каналите, които вече не трябват (стари версии, сменени звуци, вибрация). */
async function cleanupChannels(wanted: Set<string>): Promise<void> {
  if (Platform.OS !== 'android') return;
  const channels = await Notifications.getNotificationChannelsAsync();
  for (const c of channels) {
    if ((c.id.startsWith(CHANNEL_PREFIX) && !wanted.has(c.id)) || OLD_CHANNEL.test(c.id)) {
      await Notifications.deleteNotificationChannelAsync(c.id);
      created.delete(c.id);
    }
  }
}

/** Избраните звуци – от настройките (src/store/sounds.ts). */
function soundChoice() {
  const s = useSounds.getState();
  return {
    notify: findSound(s.notify, 'short', s.custom, 'notify'),
    short: (p: PrayerId) => findSound(s.short[p], 'short', s.custom),
    full: (p: PrayerId) => findSound(s.full[p], 'full', s.custom),
  };
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
    fullScreen: canUseFullScreenIntent(),
    battery: isIgnoringBatteryOptimizations(),
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
  const { t, pick } = getI18n();
  // етап 13: напомнянията за празниците – първо те, после молитвите в оставащите места
  const holidayPlan =
    permission === 'granted'
      ? planHolidayReminders({
          now: new Date(),
          options: selectTimesOptions(s).options,
          source: selectHolidaySource(s),
          enabled: s.holidayReminders ?? {},
          texts: t.holidays,
        })
      : [];
  const plan =
    permission === 'granted'
      ? [
          ...holidayPlan,
          ...planNotifications({
            now: new Date(),
            options: selectTimesOptions(s).options,
            modes: useAlertPrefs.getState().modes,
            reminderMinutes: s.reminderMinutes,
            placeName: pick(selectLocation(s).names),
            texts: { prayers: t.prayers, ...t.notifications },
            limit: NOTIFICATION_LIMIT - holidayPlan.length,
          }),
        ].sort((a, b) => a.at.getTime() - b.at.getTime())
      : [];

  const sounds = soundChoice();

  // Android (етап 5): езанът е истинска аларма в native частта – пълен звук, „Спри“,
  // екран „Аларма“. Без точни аларми (setAlarmClock не става) – остава звукът на известието.
  let alarmCount = 0;
  let notifications = plan;
  if (nativeAlarmsEnabled(exact)) {
    const alarms = plan.filter(isAlarm);
    notifications = plan.filter((n) => !isAlarm(n));
    alarmCount = Math.max(
      0,
      setAlarms(alarms.map((n) => toNativeAlarm(n, s.vibrate, pick(selectLocation(s).names), sounds.full(n.prayer!)))),
    );
  } else if (hasNativeAlarms()) {
    setAlarms([]);
  }

  // Сравнява с вече планираните: трие само променените и липсващите, добавя само новите.
  const existing = await Notifications.getAllScheduledNotificationsAsync();
  const ours = new Map(
    existing
      .filter((r) => r.identifier.startsWith('ezan-'))
      .map((r) => [r.identifier, (r.content.data as { sig?: string } | null)?.sig ?? '']),
  );

  // кой звук за всяко известие: езанът като известие – краткият звук на молитвата; другите – звукът на известията
  const wanted = [];
  for (const n of notifications) {
    const use: ChannelUse = isAlarm(n) ? 'alarm' : 'notify';
    const sound = use === 'alarm' ? sounds.short(n.prayer!) : sounds.notify;
    const channel = await ensureChannel(use, sound, s.vibrate);
    wanted.push({ n, use, sound, channel, sig: signatureOf(n, channel, exact) + '|' + notificationFileName(sound) });
  }
  const wantedIds = new Set(wanted.map((w) => w.n.id));

  for (const [id, sig] of ours) {
    const w = wanted.find((x) => x.n.id === id);
    if (!wantedIds.has(id) || !w || w.sig !== sig) {
      await Notifications.cancelScheduledNotificationAsync(id);
      ours.delete(id);
    }
  }

  for (const { n, use, sound, channel, sig } of wanted) {
    if (ours.has(n.id)) continue;
    await Notifications.scheduleNotificationAsync({
      identifier: n.id,
      content: {
        title: n.title,
        body: n.body,
        // на Android звукът е от канала, но без име на звук известието би било „тихо“;
        // на iPhone – файлът в приложението или в Library/Sounds (своите звуци)
        sound: notificationFileName(sound),
        // за Android под 8; на по-новите вибрацията е от канала
        vibrate: s.vibrate ? vibrationFor(use) : undefined,
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

  await cleanupChannels(new Set(wanted.map((w) => w.channel))).catch(() => {});

  useNotificationStatus.setState({
    count: plan.length,
    until: plan.length ? plan[plan.length - 1].at : null,
    alarms: alarmCount,
  });
}

/* ------------------------------------------------------------------ алармата (Android, етап 5) */

const isAlarm = (n: PlannedNotification) => n.kind === 'prayer' && n.sound === 'adhan' && n.prayer !== null;

/** Native алармата се ползва, ако я има в build-а и точните аларми не са забранени. */
function nativeAlarmsEnabled(exact: boolean | null): boolean {
  return Platform.OS === 'android' && hasNativeAlarms() && exact !== false;
}

/** Едно известие от плана → аларма за native частта, с всички текстове на езика на телефона. */
function toNativeAlarm(n: PlannedNotification, vibrate: boolean, place: string, sound: SoundDef): NativeAlarm {
  const { lang, t, pick } = getI18n();
  const prayer = (n.prayer ?? 'dhuhr') as PrayerId;
  const name = t.prayers[prayer];
  return {
    id: n.id,
    at: n.at.getTime(),
    prayer,
    title: t.alarm.title(name),
    arabic: PRAYERS[prayer].arabic,
    place,
    notifTitle: n.title,
    notifBody: n.body,
    colors: [...PHASE_GRADIENTS[prayer]] as [string, string, string],
    vibrate,
    // вграден – името в res/raw; свой – пътят до файла
    sound: sound.file,
    lang,
    labels: {
      app: t.alarm.app,
      // „Спри езана“ – при езан; при мелодия или свой звук – „Спри алармата“
      stop: sound.category === 'adhan' || sound.category === 'takbir' ? t.alarm.stop : t.alarm.stopAlarm,
      mute: t.alarm.mute,
      muteShort: t.alarm.muteShort,
      close: t.alarm.close,
      soundName: pick(sound.names),
      channel: t.alarm.channel,
    },
  };
}

/** Трие всички известия на Езан и ги планира наново (от „Проверка на известията“). */
export async function resetAllNotifications(): Promise<void> {
  if (!SUPPORTED) return;
  await running;
  const existing = await Notifications.getAllScheduledNotificationsAsync();
  for (const r of existing) {
    if (r.identifier.startsWith('ezan-')) await Notifications.cancelScheduledNotificationAsync(r.identifier);
  }
  created.clear();
  await rescheduleNotifications();
}

/**
 * Пробно известие след 10 сек. – със звука на известията. Връща часа, в който ще дойде.
 * (Звукът на алармата се преслушва направо в избора на звук – етап 6.)
 */
export async function sendTestNotification(): Promise<number> {
  const at = Date.now() + 10_000;
  if (!SUPPORTED) return at;
  const s = useSettings.getState();
  const sound = soundChoice().notify;
  const channel = await ensureChannel('notify', sound, s.vibrate);
  const { t } = getI18n();
  await Notifications.scheduleNotificationAsync({
    identifier: `test-${Date.now()}`,
    content: {
      title: t.notifications.testTitle,
      body: t.notifications.testBody,
      sound: notificationFileName(sound),
      vibrate: s.vibrate ? vibrationFor('notify') : undefined,
      data: { kind: 'test', at },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(at),
      channelId: channel,
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
