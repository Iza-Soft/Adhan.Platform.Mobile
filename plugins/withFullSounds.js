/**
 * Пълните звуци на алармата (целият езан, мелодиите) – само за Android.
 * Копира assets/sounds/full/* в android/app/src/main/res/raw, откъдето ги пуска
 * native алармата (AlarmService). На iPhone не трябват – там звукът на известие е до 30 сек.,
 * затова не са в списъка на expo-notifications (иначе ще влязат и в приложението за iPhone).
 */
const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

module.exports = function withFullSounds(config) {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const root = cfg.modRequest.projectRoot;
      const from = path.join(root, 'assets', 'sounds', 'full');
      const to = path.join(cfg.modRequest.platformProjectRoot, 'app', 'src', 'main', 'res', 'raw');
      if (fs.existsSync(from)) {
        fs.mkdirSync(to, { recursive: true });
        for (const name of fs.readdirSync(from)) {
          if (!/^[a-z0-9_]+\.(mp3|m4a|wav|ogg)$/.test(name)) {
            throw new Error(`withFullSounds: невалидно име на звук „${name}“ (само a-z, 0-9, _)`);
          }
          fs.copyFileSync(path.join(from, name), path.join(to, name));
        }
      }
      return cfg;
    },
  ]);
};
