import { router } from 'expo-router';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { hasNativeAlarms } from '../../../modules/adhan-native';

import { ChevronIcon } from '@/components/icons';
import { PlayButton } from '@/components/sounds/PlayButton';
import { ALARM_PRAYERS, findSound, type SoundDef } from '@/domain/sounds';
import { useI18n } from '@/i18n';
import { openExactAlarmSettings, useNotificationStatus } from '@/services/notifications';
import { useSounds } from '@/store/sounds';
import { colors } from '@/theme/colors';
import { fonts } from '@/theme/typography';

import { Group } from './controls';

/**
 * „Звуци“ в Настройки (етап 6): звукът на всяка молитва с ▶ за преслушване
 * и звукът на известията. На Android се показва пълният звук на алармата,
 * на iPhone – краткият (до 30 сек.).
 */
export function SoundsGroup() {
  const { lang, t } = useI18n();
  const s = t.sounds;
  const { full, short, notify, custom } = useSounds();
  const exact = useNotificationStatus((x) => x.exact);
  const android = Platform.OS === 'android' && hasNativeAlarms();
  // Android без „Аларми и напомняния“ – свири само краткият звук
  const fullOff = android && exact === false;

  const soundFor = (p: (typeof ALARM_PRAYERS)[number]) =>
    android ? findSound(full[p], 'full', custom) : findSound(short[p], 'short', custom);

  return (
    <>
      <Group label={s.group} note={android ? s.noteAndroid : s.noteIos}>
        {ALARM_PRAYERS.map((p, i) => (
          <SoundRow
            key={p}
            first={i === 0}
            label={t.prayers[p]}
            sound={soundFor(p)}
            lang={lang}
            onPress={() => router.push({ pathname: '/sound', params: { p } })}
          />
        ))}
      </Group>
      {fullOff && (
        <View style={styles.warn}>
          <Text style={styles.warnIcon}>⚠</Text>
          <View style={styles.warnText}>
            <Text style={styles.warnTitle}>{s.fullOffTitle}</Text>
            <Text style={styles.warnBody}>{s.fullOffText}</Text>
            <Pressable onPress={openExactAlarmSettings} accessibilityRole="button" style={styles.fix}>
              <Text style={styles.fixText}>{s.allow}</Text>
            </Pressable>
          </View>
        </View>
      )}
      <Group label={s.notifyGroup}>
        <SoundRow
          first
          label={s.notifyRow}
          sound={findSound(notify, 'short', custom, 'notify')}
          lang={lang}
          onPress={() => router.push({ pathname: '/sound', params: { p: 'notify' } })}
        />
      </Group>
    </>
  );
}

function SoundRow({
  label,
  sound,
  lang,
  onPress,
  first,
}: {
  label: string;
  sound: SoundDef;
  lang: 'bg' | 'en';
  onPress: () => void;
  first?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.row, !first && styles.border, pressed && styles.pressed]}
    >
      <View style={styles.text}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.sub} numberOfLines={1}>
          {sound.names[lang]}
        </Text>
      </View>
      <PlayButton sound={sound} />
      <ChevronIcon direction="right" size={16} color={colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 14, paddingRight: 10, paddingVertical: 9, minHeight: 56 },
  border: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.10)' },
  pressed: { opacity: 0.7 },
  text: { flex: 1, gap: 2 },
  label: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  sub: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  warn: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(227,154,75,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(227,154,75,0.45)',
  },
  warnIcon: { fontSize: 18, color: colors.warn, marginTop: -1 },
  warnText: { flex: 1, gap: 2 },
  warnTitle: { fontFamily: fonts.bold, fontSize: 14, color: colors.warn },
  warnBody: { fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 17, color: colors.textDim },
  fix: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: colors.warn,
  },
  fixText: { fontFamily: fonts.extrabold, fontSize: 13, color: '#1F1206' },
});
