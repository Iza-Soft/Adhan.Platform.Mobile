import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AppState, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GeometricPattern } from '@/components/GeometricPattern';
import { ChevronIcon } from '@/components/icons';
import { NavAppTile } from '@/components/mosques/NavAppTile';
import { navAppDesc, navAppName } from '@/components/mosques/navLabel';
import type { NavAppId } from '@/domain/navApps';
import { useI18n } from '@/i18n';
import { availableNavApps, installedMap, openStore } from '@/services/navigation';
import { useSettings } from '@/store/settings';
import { colors } from '@/theme/colors';
import { fonts } from '@/theme/typography';

/**
 * Настройки → Навигация (етап 12): с кое приложение се отваря „Упътване“ до джамия.
 * Изборът се пази завинаги (и след рестарт на телефона). Липсващите приложения – с „Изтегли“.
 */
export default function NavigationScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const n = t.nav;
  const navApp = useSettings((s) => s.navApp);
  const remembered = useSettings((s) => s.navRemembered);
  const setNavApp = useSettings((s) => s.setNavApp);
  const [installed, setInstalled] = useState<Partial<Record<NavAppId, boolean>>>({});
  const apps = availableNavApps();

  // при връщане от магазина списъкът се обновява
  useEffect(() => {
    const check = () => installedMap().then(setInstalled);
    check();
    const sub = AppState.addEventListener('change', (st) => st === 'active' && check());
    return () => sub.remove();
  }, []);

  const closing = useRef(false);
  const back = () => {
    if (closing.current) return;
    closing.current = true;
    if (router.canGoBack()) router.back();
    else router.replace('/settings');
  };

  return (
    <View style={styles.root}>
      <GeometricPattern />
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={back} hitSlop={10} accessibilityRole="button" style={styles.backBtn}>
          <ChevronIcon direction="left" size={18} color={colors.gold} />
          <Text style={styles.backText}>{n.back}</Text>
        </Pressable>
      </View>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>{n.title}</Text>
        <Text style={styles.intro}>{n.intro}</Text>

        <View style={styles.card} accessibilityRole="radiogroup" accessibilityLabel={n.title}>
          {apps.map((app, i) => {
            const has = installed[app.id] ?? true;
            const on = remembered && navApp === app.id;
            const name = navAppName(app.id, t);
            return (
              <Pressable
                key={app.id}
                onPress={() => (has ? setNavApp(app.id) : openStore(app.id))}
                accessibilityRole="radio"
                accessibilityState={{ checked: on, disabled: !has }}
                accessibilityLabel={`${name}. ${navAppDesc(app, has, t)}`}
                accessibilityHint={has ? undefined : n.download}
                style={({ pressed }) => [styles.row, i > 0 && styles.border, on && styles.rowOn, pressed && styles.pressed]}
              >
                <NavAppTile id={app.id} dim={!has} />
                <View style={styles.text}>
                  <Text style={[styles.name, on && styles.nameOn, !has && styles.nameDim]}>{name}</Text>
                  <Text style={styles.desc}>{navAppDesc(app, has, t)}</Text>
                </View>
                {!has && (
                  <View style={styles.get}>
                    <Text style={styles.getText}>{n.download}</Text>
                  </View>
                )}
                <View style={[styles.radio, on && styles.radioOn]}>{on && <View style={styles.dot} />}</View>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.note}>{n.note}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.base },
  header: { paddingHorizontal: 16, paddingBottom: 4 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, alignSelf: 'flex-start' },
  backText: { fontFamily: fonts.bold, fontSize: 15, color: colors.gold },
  content: { paddingHorizontal: 16, gap: 8 },
  title: { fontFamily: fonts.extrabold, fontSize: 26, color: colors.text, marginTop: 4 },
  intro: { fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 19, color: colors.muted, marginBottom: 8 },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 18,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 10, minHeight: 64 },
  rowOn: { backgroundColor: 'rgba(212,168,87,0.10)' },
  border: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.10)' },
  pressed: { opacity: 0.7 },
  text: { flex: 1, gap: 2 },
  name: { fontFamily: fonts.bold, fontSize: 15.5, color: colors.text },
  nameOn: { fontFamily: fonts.extrabold, color: colors.gold },
  nameDim: { color: 'rgba(242,239,232,0.6)' },
  desc: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, color: colors.muted },
  get: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(212,168,87,0.6)',
  },
  getText: { fontFamily: fonts.bold, fontSize: 12, color: colors.gold },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: 'rgba(242,239,232,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { borderColor: colors.gold },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.gold },
  note: { fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 18, color: colors.muted, marginTop: 6, paddingHorizontal: 4 },
});
