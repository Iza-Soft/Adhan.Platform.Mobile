import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import { create } from 'zustand';

import {
  deleteNotificationSound,
  deleteShortSound,
  getAudioDuration,
  iosSoundsDirectoryUri,
  prepareNotificationSound,
  prepareShortSound,
  previewNativeSound,
  stopNativePreview,
} from '../../modules/adhan-native';

import {
  FULL_MAX_SEC,
  NOTIFY_MAX_SEC,
  nameFromFile,
  notificationFileName,
  SHORT_MAX_SEC,
  validateUpload,
  type CustomSound,
  type SoundDef,
  type SoundKind,
  type SoundUse,
} from '@/domain/sounds';
import { useSounds } from '@/store/sounds';

/**
 * Звуците (етап 6): преслушване и своите звуци на потребителя.
 * - Android: преслушването и алармата са в native частта (MediaPlayer) – и за вградените
 *   звуци в res/raw, и за своите файлове в паметта на приложението.
 * - iPhone: преслушване с expo-audio; своите звуци се преобразуват в .caf в Library/Sounds,
 *   откъдето iOS ги пуска като звук на известие. По-дългите от 30 сек. се скъсяват
 *   на естествена пауза, с плавно заглъхване (iOS не пуска звук над 30 сек.).
 */

/* ------------------------------------------------------------------ преслушване */

export const usePreview = create<{ playing: string | null }>(() => ({ playing: null }));

let iosPlayer: AudioPlayer | null = null;
let endTimer: ReturnType<typeof setTimeout> | undefined;

function sourceForIos(s: SoundDef): string | null {
  if (s.id === 'system') return null; // звукът на телефона не може да се пусне от приложението на iPhone
  if (s.custom) {
    const dir = iosSoundsDirectoryUri();
    return dir ? `${dir}${s.file}` : null;
  }
  // вградените кратки звуци са в приложението (expo-notifications ги слага там)
  return `${Paths.bundle.uri}${notificationFileName(s)}`;
}

export function stopPreview(): void {
  clearTimeout(endTimer);
  stopNativePreview();
  if (iosPlayer) {
    try {
      iosPlayer.pause();
      iosPlayer.remove();
    } catch {
      // нищо
    }
    iosPlayer = null;
  }
  usePreview.setState({ playing: null });
}

/** Пуска или спира звука (втори тап по същия – спира). */
export async function togglePreview(s: SoundDef): Promise<void> {
  const wasPlaying = usePreview.getState().playing === s.id;
  stopPreview();
  if (wasPlaying) return;

  let started = false;
  if (Platform.OS === 'android') {
    started = previewNativeSound(s.file);
  } else if (Platform.OS === 'ios') {
    const uri = sourceForIos(s);
    if (uri) {
      await setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
      iosPlayer = createAudioPlayer(uri);
      iosPlayer.addListener('playbackStatusUpdate', (st) => {
        if (st.didJustFinish) stopPreview();
      });
      iosPlayer.play();
      started = true;
    }
  }
  if (!started) return;
  usePreview.setState({ playing: s.id });
  // край на звука (native преслушването не съобщава кога свършва)
  endTimer = setTimeout(stopPreview, (s.id === 'system' ? 3 : Math.min(s.durationSec, FULL_MAX_SEC)) * 1000 + 500);
}

/* ------------------------------------------------------------------ свои звуци */

export type AddResult =
  | { ok: true; sound: CustomSound }
  | { ok: false; reason: 'canceled' | 'tooLong' | 'tooBig' | 'unreadable' | 'unsupported'; name?: string; durationSec?: number };

const PICK_TYPES = ['audio/*', 'video/mp4', 'application/ogg'];

function customDir(): Directory {
  const dir = new Directory(Paths.document, 'sounds');
  dir.create({ idempotent: true, intermediates: true });
  return dir;
}

/**
 * Избор на файл от телефона и добавяне като свой звук.
 * Android – пълен звук (за алармата); iPhone – кратък, до 30 сек. (за известието).
 */
export async function addCustomSound(
  kind: SoundKind,
  /** Файлът е избран – започва обработката (за индикатора „Изрязване…“). */
  onPicked?: (name: string) => void,
  /** 'notify' – звук за известия: до 10 сек., по-дълъг не се добавя. */
  use: SoundUse = 'alarm',
): Promise<AddResult> {
  if (Platform.OS === 'web') return { ok: false, reason: 'unsupported' };
  const picked = await DocumentPicker.getDocumentAsync({ type: PICK_TYPES, copyToCacheDirectory: true });
  if (picked.canceled || !picked.assets?.length) return { ok: false, reason: 'canceled' };
  const asset = picked.assets[0];
  const name = nameFromFile(asset.name);
  const id = `custom_${Date.now()}`;
  onPicked?.(name);
  const maxSec = use === 'notify' ? NOTIFY_MAX_SEC : SHORT_MAX_SEC;

  try {
    if (Platform.OS === 'ios') {
      // iPhone: преобразуване в .caf (iOS не приема mp3 за известия); по-дълъг – не се записва
      const file = `${id}.caf`;
      if (asset.size !== undefined && validateUpload('short', 1, asset.size) === 'tooBig') {
        return { ok: false, reason: 'tooBig', name };
      }
      // звук за известия – до 10 сек., по-дълъг не се добавя
      if (use === 'notify') {
        const d = (await getAudioDuration(asset.uri)) ?? -1;
        const problem = validateUpload('short', d, asset.size, 'notify');
        if (problem) return { ok: false, reason: problem === 'empty' ? 'unreadable' : problem, name, durationSec: d };
      }
      // дълъг запис се скъсява до 30 сек. – на пауза, с плавно заглъхване (виж AdhanNativeModule.swift)
      const r = await prepareNotificationSound(asset.uri, file, maxSec);
      if (!r) return { ok: false, reason: 'unsupported' };
      if (!r.ok || validateUpload('short', r.duration, asset.size)) {
        deleteNotificationSound(file);
        return { ok: false, reason: 'unreadable', name };
      }
      const sound: CustomSound = {
        id,
        kind: 'short',
        name,
        file,
        durationSec: r.duration,
        originalSec: r.trimmed ? r.originalDuration : undefined,
        use,
      };
      useSounds.getState().addCustom(sound);
      return { ok: true, sound };
    }

    // Android, кратък: откъс до 30 сек. (срез на пауза, заглъхване) в Notifications/Ezan –
    // оттам го чете системата за известия (виж ShortSound.kt)
    if (kind === 'short') {
      if (asset.size !== undefined && validateUpload('short', 1, asset.size) === 'tooBig') {
        return { ok: false, reason: 'tooBig', name };
      }
      if (use === 'notify') {
        const d = (await getAudioDuration(asset.uri)) ?? -1;
        const problem = validateUpload('short', d, asset.size, 'notify');
        if (problem) return { ok: false, reason: problem === 'empty' ? 'unreadable' : problem, name, durationSec: d };
      }
      const r = await prepareShortSound(asset.uri, name, maxSec);
      if (!r) return { ok: false, reason: 'unsupported' };
      if (validateUpload('short', r.duration, asset.size)) {
        deleteShortSound(r.uri);
        return { ok: false, reason: 'unreadable', name };
      }
      const sound: CustomSound = {
        id,
        kind: 'short',
        name,
        file: r.uri,
        durationSec: r.duration,
        originalSec: r.trimmed ? r.originalDuration : undefined,
        use,
      };
      useSounds.getState().addCustom(sound);
      return { ok: true, sound };
    }

    // Android, пълен: копие в паметта на приложението; алармата го пуска оттам
    const duration = (await getAudioDuration(asset.uri)) ?? -1;
    const problem = validateUpload(kind, duration, asset.size);
    if (problem) return { ok: false, reason: problem === 'empty' ? 'unreadable' : problem, name, durationSec: duration };
    const ext = (asset.name.match(/\.([a-z0-9]{2,4})$/i)?.[1] ?? 'mp3').toLowerCase();
    const dest = new File(customDir(), `${id}.${ext}`);
    await new File(asset.uri).copy(dest);
    const sound: CustomSound = { id, kind, name, file: dest.uri, durationSec: duration };
    useSounds.getState().addCustom(sound);
    return { ok: true, sound };
  } catch {
    return { ok: false, reason: 'unreadable', name };
  }
}

/** Маха своя звук (и файла му). Молитвите с него се връщат към звука по подразбиране. */
export function removeCustomSound(sound: CustomSound): void {
  if (usePreview.getState().playing === sound.id) stopPreview();
  try {
    if (Platform.OS === 'ios') deleteNotificationSound(sound.file);
    else if (sound.kind === 'short') deleteShortSound(sound.file);
    else {
      const f = new File(sound.file);
      if (f.exists) f.delete();
    }
  } catch {
    // файлът вече го няма
  }
  useSounds.getState().removeCustom(sound.id);
}

