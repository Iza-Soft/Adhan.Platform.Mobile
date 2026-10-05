import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { modeFor, type NavAppId, type TravelMode } from '@/domain/navApps';
import { useI18n } from '@/i18n';
import { availableNavApps, installedMap } from '@/services/navigation';
import { colors } from '@/theme/colors';
import { fonts } from '@/theme/typography';

import { NavAppTile } from './NavAppTile';
import { navAppName } from './navLabel';

interface Props {
  visible: boolean;
  /** Името на джамията и разстоянието („350 м“). */
  title: string;
  distance: string;
  mode: TravelMode;
  /** Приложението, което вече го няма на телефона (изтрито след избора). */
  missing?: NavAppId | null;
  onPick: (id: NavAppId, remember: boolean) => void;
  onClose: () => void;
}

/**
 * „Отвори с…“ (етап 12) – при първото „Упътване“ или ако избраното приложение е изтрито.
 * Показват се само инсталираните приложения и „Автоматично“. „Запомни избора“ е отметнато.
 */
export function NavSheet({ visible, title, distance, mode, missing, onPick, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const n = t.nav;
  const [installed, setInstalled] = useState<Partial<Record<NavAppId, boolean>> | null>(null);
  const [remember, setRemember] = useState(true);

  useEffect(() => {
    if (visible) installedMap().then(setInstalled);
  }, [visible]);

  // „Автоматично“ – последно: първо конкретните приложения
  const apps = availableNavApps().filter((a) => a.id !== 'auto' && installed?.[a.id]);
  const list = [...apps.map((a) => a.id), 'auto' as const];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel={n.close} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 24 }]} accessibilityViewIsModal>
        <View style={styles.handle} />
        <Text style={styles.title} accessibilityRole="header">
          {n.sheetTitle(title)}
        </Text>
        <Text style={styles.sub}>{n.sheetSub(distance)}</Text>
        {missing && <Text style={styles.missing}>{n.missing(navAppName(missing, t))}</Text>}

        <View style={styles.grid}>
          {installed &&
            list.map((id) => {
              const m = modeFor(id, mode);
              const name = navAppName(id, t);
              const modeText = m === 'walk' ? n.walk : n.drive;
              return (
                <Pressable
                  key={id}
                  onPress={() => onPick(id, remember)}
                  accessibilityRole="button"
                  accessibilityLabel={`${name}, ${modeText}`}
                  style={({ pressed }) => [styles.app, pressed && styles.appPressed]}
                >
                  <NavAppTile id={id} size={48} />
                  <Text style={styles.appName} numberOfLines={1}>
                    {name}
                  </Text>
                  <Text style={styles.appMode}>{modeText}</Text>
                </Pressable>
              );
            })}
        </View>

        <Pressable
          onPress={() => setRemember((v) => !v)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: remember }}
          style={styles.remember}
        >
          <View style={[styles.box, remember && styles.boxOn]}>
            {remember && (
              <Svg width={14} height={14} viewBox="0 0 24 24">
                <Path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke={colors.goldInk} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            )}
          </View>
          <View style={styles.rememberText}>
            <Text style={styles.rememberLabel}>{n.remember}</Text>
            <Text style={styles.rememberHint}>{n.rememberHint}</Text>
          </View>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(3,6,12,0.55)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#16243A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 10,
    paddingHorizontal: 20,
  },
  handle: { width: 38, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)', alignSelf: 'center', marginBottom: 16 },
  title: { fontFamily: fonts.extrabold, fontSize: 20, color: colors.text },
  sub: { fontFamily: fonts.medium, fontSize: 13, color: colors.muted, marginTop: 4 },
  missing: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18, color: colors.warn, marginTop: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 18 },
  app: {
    width: '31%',
    flexGrow: 1,
    maxWidth: '32%',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  appPressed: { backgroundColor: 'rgba(212,168,87,0.14)', borderColor: 'rgba(212,168,87,0.6)' },
  appName: { fontFamily: fonts.bold, fontSize: 13, color: colors.text },
  appMode: { fontFamily: fonts.medium, fontSize: 11, color: colors.muted },
  remember: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 20 },
  box: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'rgba(242,239,232,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: { backgroundColor: colors.gold, borderColor: colors.gold },
  rememberText: { flex: 1 },
  rememberLabel: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  rememberHint: { fontFamily: fonts.medium, fontSize: 12, color: colors.muted },
});
