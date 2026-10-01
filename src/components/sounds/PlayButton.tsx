import { Pressable, StyleSheet } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import type { SoundDef } from '@/domain/sounds';
import { useI18n } from '@/i18n';
import { togglePreview, usePreview } from '@/services/sounds';
import { colors } from '@/theme/colors';

/** Кръглият бутон ▶ / ❚❚ – преслушване на звука. */
export function PlayButton({ sound }: { sound: SoundDef }) {
  const { lang, t } = useI18n();
  const playing = usePreview((s) => s.playing === sound.id);
  const name = sound.names[lang];
  return (
    <Pressable
      onPress={() => togglePreview(sound)}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={playing ? t.sounds.stop(name) : t.sounds.play(name)}
      style={({ pressed }) => [styles.btn, playing && styles.on, pressed && styles.pressed]}
    >
      <Svg width={13} height={13} viewBox="0 0 24 24">
        {playing ? (
          <>
            <Rect x={5} y={4} width={5} height={16} rx={1.5} fill={colors.goldInk} />
            <Rect x={14} y={4} width={5} height={16} rx={1.5} fill={colors.goldInk} />
          </>
        ) : (
          <Path d="M7 4.5v15l13-7.5z" fill={colors.text} />
        )}
      </Svg>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  on: { backgroundColor: colors.gold, borderColor: colors.gold },
  pressed: { opacity: 0.7 },
});
