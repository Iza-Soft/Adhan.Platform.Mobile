import {
  NOTIFY_MAX_SEC,
  allSounds,
  BUILTIN_SOUNDS,
  DEFAULT_FULL,
  DEFAULT_SHORT,
  findSound,
  formatDuration,
  nameFromFile,
  notificationFileName,
  validateUpload,
  type CustomSound,
} from '../sounds';

const mine: CustomSound = {
  id: 'custom_1',
  kind: 'full',
  name: 'Ezan Bania Bashi',
  file: 'file:///data/user/0/com.ilkoadamov.adhan/files/sounds/custom_1.mp3',
  durationSec: 201,
};
const mineIos: CustomSound = { id: 'custom_2', kind: 'short', name: 'Tekbir', file: 'custom_2.caf', durationSec: 26 };

describe('каталогът на звуците', () => {
  it('има пълни и кратки звуци; кратките са до 30 сек.', () => {
    expect(BUILTIN_SOUNDS.some((s) => s.kind === 'full')).toBe(true);
    for (const s of BUILTIN_SOUNDS.filter((x) => x.kind === 'short')) expect(s.durationSec).toBeLessThanOrEqual(30);
  });

  it('id-тата са уникални, а имената на файловете стават за Android (a-z, 0-9, _)', () => {
    const ids = BUILTIN_SOUNDS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of BUILTIN_SOUNDS) expect(s.file).toMatch(/^[a-z0-9_]+$/);
  });

  it('звуците по подразбиране ги има', () => {
    expect(findSound(DEFAULT_FULL, 'full', []).id).toBe(DEFAULT_FULL);
    expect(findSound(DEFAULT_SHORT, 'short', []).id).toBe(DEFAULT_SHORT);
  });
});

describe('избраният звук', () => {
  it('своят звук се намира', () => {
    expect(findSound('custom_1', 'full', [mine]).names.bg).toBe('Ezan Bania Bashi');
    expect(allSounds([mine, mineIos])).toHaveLength(BUILTIN_SOUNDS.length + 2);
  });

  it('изтрит свой звук → звукът по подразбиране', () => {
    expect(findSound('custom_1', 'full', []).id).toBe(DEFAULT_FULL);
  });

  it('пълен звук не може да е кратък (и обратно)', () => {
    expect(findSound('adhan_madinah', 'short', []).id).toBe(DEFAULT_SHORT);
    expect(findSound('takbir_makkah', 'full', []).id).toBe(DEFAULT_FULL);
  });

  it('известията – само звънове; алармата – без звънове', () => {
    expect(findSound('chime_soft', 'short', [], 'notify').id).toBe('chime_soft');
    expect(findSound('takbir_makkah', 'short', [], 'notify').id).toBe('system');
    expect(findSound('chime_soft', 'short', []).id).toBe(DEFAULT_SHORT);
    expect(findSound('takbir_aqsa', 'short', []).id).toBe('takbir_aqsa');
    // премахнатите мелодии → звукът по подразбиране
    expect(findSound('melody_nur_short', 'short', []).id).toBe(DEFAULT_SHORT);
  });

  it('звукът на телефона – само за известията, „default“ за expo-notifications', () => {
    const sys = findSound('system', 'short', [], 'notify');
    expect(sys.id).toBe('system');
    expect(notificationFileName(sys)).toBe('default');
    expect(findSound('system', 'short', []).id).toBe(DEFAULT_SHORT);
  });

  it('своят звук за известия е само в списъка на известията', () => {
    const n: CustomSound = { id: 'custom_9', kind: 'short', name: 'Ding', file: 'content://x', durationSec: 3, use: 'notify' };
    expect(findSound('custom_9', 'short', [n], 'notify').id).toBe('custom_9');
    expect(findSound('custom_9', 'short', [n]).id).toBe(DEFAULT_SHORT);
    expect(findSound('custom_2', 'short', [mineIos], 'notify').id).toBe('system');
  });

  it('файлът за известието: вграден – с разширение; свой на iPhone – .caf', () => {
    expect(notificationFileName(findSound('chime_soft', 'short', [], 'notify'))).toBe('chime_soft.wav');
    expect(notificationFileName(findSound('custom_2', 'short', [mineIos]))).toBe('custom_2.caf');
  });
});

describe('свой звук – проверка', () => {
  it('на iPhone – до 30 сек.', () => {
    expect(validateUpload('short', 29.9, 500_000)).toBeNull();
    expect(validateUpload('short', 30.4, 500_000)).toBeNull(); // закръгляне на дължината
    expect(validateUpload('short', 222, 3_000_000)).toBe('tooLong');
  });

  it('за известия – до 10 сек.; по-дълъг не се добавя', () => {
    expect(validateUpload('short', 9.8, 100_000, 'notify')).toBeNull();
    expect(validateUpload('short', 12, 100_000, 'notify')).toBe('tooLong');
  });

  it('на Android – до 15 мин. и 60 MB', () => {
    expect(validateUpload('full', 222, 3_000_000)).toBeNull();
    expect(validateUpload('full', 16 * 60, 3_000_000)).toBe('tooLong');
    expect(validateUpload('full', 222, 80 * 1024 * 1024)).toBe('tooBig');
  });

  it('празен или нечетим файл', () => {
    expect(validateUpload('full', -1, 1000)).toBe('empty');
    expect(validateUpload('short', 0, 1000)).toBe('empty');
  });

  it('името от файла и дължината', () => {
    expect(nameFromFile('Ezan_Bania-Bashi.mp3')).toBe('Ezan Bania-Bashi');
    expect(nameFromFile('.mp3')).toBe('Sound');
    expect(formatDuration(222)).toBe('3:42');
    expect(formatDuration(4.2)).toBe('0:04');
  });
});

describe('вградените звуци за известията', () => {
  const app = require('../../../app.json');
  const plugin = app.expo.plugins.find((p: unknown) => Array.isArray(p) && p[0] === 'expo-notifications');
  const listed: string[] = plugin[1].sounds;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require('fs');

  it('всеки е до 10 сек., с валидно име за Android и е в app.json', () => {
    const notify = BUILTIN_SOUNDS.filter((s) => s.kind === 'short' && s.category === 'chime' && s.id !== 'system');
    expect(notify.length).toBe(22);
    for (const s of notify) {
      expect(s.durationSec).toBeLessThanOrEqual(NOTIFY_MAX_SEC);
      expect(s.file).toMatch(/^[a-z][a-z0-9_]*$/);
      const rel = `./assets/sounds/${s.file}.${s.ext}`;
      expect(listed).toContain(rel);
      expect(fs.existsSync(`${process.cwd()}/${rel}`)).toBe(true);
    }
  });

  it('id-тата са уникални', () => {
    const ids = BUILTIN_SOUNDS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
