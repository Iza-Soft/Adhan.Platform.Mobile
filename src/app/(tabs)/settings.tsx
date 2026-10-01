import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GeometricPattern } from '@/components/GeometricPattern';
import { NotificationsGroup } from '@/components/settings/NotificationsGroup';
import { PinIcon } from '@/components/icons';
import {
  Choice,
  Group,
  NavRow,
  Row,
  StepperRow,
  SwitchRow,
  settingsStyles,
} from '@/components/settings/controls';
import { useTabBarHeight } from '@/components/TabBar';
import { CALC_METHODS, HIGH_LAT_RULES, isHighLatitude, isPolar } from '@/domain/calc';
import { PRAYER_IDS } from '@/domain/prayers';
import { useI18n } from '@/i18n';
import { refreshLocation, useLocationStatus } from '@/services/location';
import { selectLocation, useSettings } from '@/store/settings';
import { colors } from '@/theme/colors';
import { fonts } from '@/theme/typography';

const APP_VERSION = Constants.expoConfig?.version ?? '';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useTabBarHeight();
  const { lang, t } = useI18n();
  const s = useSettings();
  const location = selectLocation(s);
  const status = useLocationStatus((x) => x.status);
  const [open, setOpen] = useState<'method' | 'asr' | 'highLat' | null>(null);

  const isCalc = location.source === 'calc';
  const highLat = isCalc && isHighLatitude(location.latitude);
  const anyOffset = PRAYER_IDS.some((id) => s.offsets[id] !== 0);
  const toggle = (what: 'method' | 'asr' | 'highLat') => setOpen((cur) => (cur === what ? null : what));

  return (
    <View style={styles.root}>
      <GeometricPattern />
      {/* списъкът свършва над долната навигация, за да не се застъпва с нея */}
      <ScrollView
        style={{ marginBottom: tabBarHeight }}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 8, paddingBottom: 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>{t.settings.title}</Text>

        {/* ---- Място ---- */}
        <Group label={t.settings.groupPlace}>
          <Pressable
            onPress={() => router.push('/place')}
            accessibilityRole="button"
            accessibilityLabel={`${location.names[lang]}. ${t.settings.change}`}
            style={({ pressed }) => [styles.placeRow, pressed && styles.pressed]}
          >
            <PinIcon size={18} color={colors.gold} />
            <View style={styles.placeText}>
              <Text style={styles.placeName}>{location.names[lang]}</Text>
              {location.detail ? <Text style={styles.placeDetail}>{location.detail[lang]}</Text> : null}
              <Text style={styles.badge}>{isCalc ? t.settings.sourceCalc : t.settings.sourceMufti}</Text>
            </View>
            <Text style={styles.link}>{t.settings.change}</Text>
          </Pressable>
          <SwitchRow label={t.settings.auto} value={s.autoLocation} onChange={s.setAutoLocation} />
          {s.autoLocation && (
            <Row>
              <View style={styles.statusBox}>
                <View style={styles.statusLine}>
                  {status === 'locating' && <ActivityIndicator size="small" color={colors.gold} />}
                  <Text style={[styles.statusText, status === 'locating' && styles.statusBusy]}>
                  {status === 'locating'
                    ? t.settings.locating
                    : status === 'denied'
                      ? t.settings.denied
                      : status === 'unavailable'
                        ? t.settings.unavailable
                        : t.settings.autoHint}
                  </Text>
                </View>
                {status === 'denied' ? (
                  <Pressable onPress={() => Linking.openSettings()} accessibilityRole="button">
                    <Text style={styles.link}>{t.settings.openSettings}</Text>
                  </Pressable>
                ) : status !== 'locating' ? (
                  <Pressable onPress={() => refreshLocation()} accessibilityRole="button">
                    <Text style={styles.link}>{t.settings.refresh}</Text>
                  </Pressable>
                ) : null}
              </View>
            </Row>
          )}
        </Group>

        {/* ---- Известия ---- */}
        <NotificationsGroup />

        {/* ---- Часове ---- */}
        {isCalc ? (
          <Group
            label={t.settings.groupTimes}
            note={
              isPolar(location.latitude)
                ? t.settings.polarNote(Math.abs(location.latitude).toFixed(0))
                : highLat
                  ? t.settings.highLatNote(Math.abs(location.latitude).toFixed(0))
                  : t.settings.asrNote
            }
          >
            <NavRow first label={t.settings.method} value={t.methods[s.method]} onPress={() => toggle('method')} />
            {open === 'method' && (
              <Choice
                options={CALC_METHODS.map((m) => ({ value: m, label: t.methods[m] }))}
                value={s.method}
                onChange={(m) => {
                  s.setMethod(m);
                  setOpen(null);
                }}
              />
            )}
            <NavRow
              label={t.settings.asr}
              value={s.madhab === 'hanafi' ? t.settings.hanafi : t.settings.shafi}
              onPress={() => toggle('asr')}
            />
            {open === 'asr' && (
              <Choice
                options={[
                  { value: 'shafi' as const, label: t.settings.shafi, desc: t.settings.shafiDesc },
                  { value: 'hanafi' as const, label: t.settings.hanafi, desc: t.settings.hanafiDesc },
                ]}
                value={s.madhab}
                onChange={(m) => {
                  s.setMadhab(m);
                  setOpen(null);
                }}
              />
            )}
            {highLat && (
              <>
                <NavRow
                  label={t.settings.highLat}
                  value={t.highLatRules[s.highLatRule].name}
                  onPress={() => toggle('highLat')}
                />
                {open === 'highLat' && (
                  <Choice
                    options={HIGH_LAT_RULES.map((r) => ({
                      value: r,
                      label: t.highLatRules[r].name,
                      desc: t.highLatRules[r].desc,
                    }))}
                    value={s.highLatRule}
                    onChange={(r) => {
                      s.setHighLatRule(r);
                      setOpen(null);
                    }}
                  />
                )}
              </>
            )}
          </Group>
        ) : (
          <Group label={t.settings.groupTimes} note={t.settings.sourceMuftiNote}>
            <Row first>
              <Text style={settingsStyles.label}>{t.settings.sourceMufti}</Text>
            </Row>
          </Group>
        )}

        {/* ---- Корекции ---- */}
        <Group label={t.settings.groupCorrections} note={t.settings.offsetsNote}>
          {PRAYER_IDS.map((id, i) => (
            <StepperRow
              key={id}
              first={i === 0}
              label={t.prayers[id]}
              valueText={t.settings.minutes(s.offsets[id])}
              highlighted={s.offsets[id] !== 0}
              onMinus={() => s.changeOffset(id, -1)}
              onPlus={() => s.changeOffset(id, 1)}
              minusLabel={t.settings.decrease(t.prayers[id])}
              plusLabel={t.settings.increase(t.prayers[id])}
            />
          ))}
          {anyOffset && (
            <Pressable onPress={s.resetOffsets} accessibilityRole="button" style={styles.resetRow}>
              <Text style={styles.link}>{t.settings.reset}</Text>
            </Pressable>
          )}
        </Group>

        <Group label={t.settings.hijri} note={isCalc ? t.settings.hijriNoteAbroad : t.settings.hijriNote}>
          <StepperRow
            first
            label={t.settings.hijri}
            valueText={t.settings.days(s.hijriAdjust)}
            highlighted={s.hijriAdjust !== 0}
            onMinus={() => s.changeHijriAdjust(-1)}
            onPlus={() => s.changeHijriAdjust(1)}
            minusLabel={t.settings.decrease(t.settings.hijri)}
            plusLabel={t.settings.increase(t.settings.hijri)}
          />
        </Group>

        {/* ---- Приложение: източниците и поверителността са в „За приложението“ ---- */}
        <Group label={t.settings.groupApp}>
          <NavRow first label={t.settings.about} value={APP_VERSION} onPress={() => router.push('/about')} />
        </Group>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.base },
  content: { paddingHorizontal: 16, gap: 20 },
  title: { fontFamily: fonts.extrabold, fontSize: 26, color: colors.text, marginLeft: 4 },
  placeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  pressed: { backgroundColor: 'rgba(255,255,255,0.04)' },
  placeText: { flex: 1, gap: 2 },
  placeName: { fontFamily: fonts.extrabold, fontSize: 17, color: colors.text },
  placeDetail: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.muted },
  badge: { fontFamily: fonts.semibold, fontSize: 11.5, color: colors.gold, marginTop: 2 },
  link: { fontFamily: fonts.bold, fontSize: 13, color: colors.gold },
  statusBox: { flex: 1, gap: 6 },
  statusLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusText: { flex: 1, fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 17, color: colors.muted },
  statusBusy: { color: colors.text },
  resetRow: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.10)',
  },
});
