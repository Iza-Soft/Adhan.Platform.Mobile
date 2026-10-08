import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AppState, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  isIgnoringBatteryOptimizations,
  openAppLaunchSettings,
  openAppSettings,
  openBatteryOptimizationSettings,
} from '../../modules/hayya-native';

import { GeometricPattern } from '@/components/GeometricPattern';
import { ChevronIcon } from '@/components/icons';
import { BATTERY_BRANDS, batteryBrand, type BatteryBrand } from '@/domain/device';
import { useI18n } from '@/i18n';
import { colors } from '@/theme/colors';
import { fonts } from '@/theme/typography';

const constants = Platform.constants as { Manufacturer?: string; Brand?: string; Model?: string };
const DETECTED: BatteryBrand = batteryBrand(constants.Manufacturer, constants.Brand);
/** „Samsung Galaxy A54“ – производителят с главна буква и моделът. */
const PHONE = [constants.Manufacturer, constants.Model]
  .filter(Boolean)
  .map((s) => s!.charAt(0).toUpperCase() + s!.slice(1))
  .join(' ');

/**
 * „Работа на заден план“: как да се махне оптимизацията на батерията за Езан –
 * стъпките според марката на телефона (Samsung, Xiaomi, Huawei, OPPO, друг).
 * Без това алармите на някои телефони закъсняват или не звънят.
 */
export default function BatteryScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const b = t.battery;
  const [brand, setBrand] = useState<BatteryBrand>(DETECTED);
  const [ok, setOk] = useState(() => isIgnoringBatteryOptimizations());
  const huawei = brand === 'huawei';

  // след връщане от настройките на телефона – проверява наново
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') setOk(isIgnoringBatteryOptimizations());
    });
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
          <Text style={styles.backText}>{t.settings.title}</Text>
        </Pressable>
      </View>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>{b.title}</Text>
        <Text style={styles.lede}>{b.lede}</Text>

        {PHONE ? (
          <View style={styles.phone}>
            <Text style={styles.phoneLabel}>{b.yourPhone}</Text>
            <Text style={styles.phoneName}>{PHONE}</Text>
          </View>
        ) : null}

        <View style={styles.steps}>
          {b.steps[brand].map(([text, path, note], i) => (
            <View key={`${brand}-${i}`} style={styles.step}>
              <View style={styles.num}>
                <Text style={styles.numText}>{i + 1}</Text>
              </View>
              <Text style={styles.stepText}>
                {text}
                {path ? (
                  <>
                    {' '}
                    <Text style={styles.path}> {path} </Text>
                  </>
                ) : null}
                {note ? <Text style={styles.note}>{'\n'}{note}</Text> : null}
              </Text>
            </View>
          ))}
        </View>

        {/* Huawei: направо „Стартиране на приложения“; останалите – настройките на Hayya */}
        <Pressable
          onPress={huawei ? openAppLaunchSettings : openAppSettings}
          accessibilityRole="button"
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        >
          <Text style={styles.buttonText}>{huawei ? b.openHuawei : b.open}</Text>
        </Pressable>
        {(brand === 'other' || huawei) && (
          <Pressable onPress={openBatteryOptimizationSettings} accessibilityRole="button" style={styles.secondary}>
            <Text style={styles.link}>{b.openList}</Text>
          </Pressable>
        )}

        <View style={[styles.status, ok ? styles.statusOk : ok === false ? styles.statusBad : null]}>
          <Text style={styles.statusLabel}>{b.now}</Text>
          <Text style={[styles.statusValue, ok ? styles.okText : ok === false ? styles.badText : null]}>
            {ok ? b.ok : ok === false ? b.bad : b.unknown}
          </Text>
        </View>
        {/* Huawei: проверката вижда само „Оптимизация на батерията“ (стъпка 4), не „Стартиране на приложения“ */}
        {huawei && <Text style={styles.checkNote}>{b.huaweiCheckNote}</Text>}

        <Text style={styles.other}>{b.otherPhone}</Text>
        <View style={styles.chips}>
          {BATTERY_BRANDS.map((x) => (
            <Pressable
              key={x}
              onPress={() => setBrand(x)}
              accessibilityRole="button"
              accessibilityState={{ selected: x === brand }}
              style={[styles.chip, x === brand && styles.chipOn]}
            >
              <Text style={[styles.chipText, x === brand && styles.chipTextOn]}>{b.brands[x]}</Text>
            </Pressable>
          ))}
        </View>

        <Pressable onPress={() => Linking.openURL('https://dontkillmyapp.com')} accessibilityRole="link">
          <Text style={styles.more}>{b.more}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const GREEN = '#5FBF8F';

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.base },
  header: { paddingHorizontal: 16, paddingBottom: 4 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, alignSelf: 'flex-start' },
  backText: { fontFamily: fonts.bold, fontSize: 15, color: colors.gold },
  content: { paddingHorizontal: 16, gap: 12 },
  title: { fontFamily: fonts.extrabold, fontSize: 26, color: colors.text, marginTop: 4 },
  lede: { fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 19.5, color: colors.textDim },
  phone: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    gap: 2,
  },
  phoneLabel: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.muted },
  phoneName: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  steps: { gap: 4 },
  step: { flexDirection: 'row', gap: 12, paddingVertical: 8 },
  num: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(212,168,87,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  numText: { fontFamily: fonts.extrabold, fontSize: 13, color: colors.gold, includeFontPadding: false },
  stepText: { flex: 1, fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, color: colors.text },
  path: { fontFamily: fonts.bold, backgroundColor: 'rgba(255,255,255,0.08)', color: colors.text },
  note: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.muted },
  button: {
    height: 52,
    borderRadius: 999,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  pressed: { opacity: 0.8 },
  buttonText: { fontFamily: fonts.extrabold, fontSize: 15, color: colors.goldInk },
  secondary: { alignItems: 'center', paddingVertical: 6 },
  link: { fontFamily: fonts.bold, fontSize: 14, color: colors.gold },
  status: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  statusOk: { backgroundColor: 'rgba(95,191,143,0.12)', borderColor: 'rgba(95,191,143,0.4)' },
  statusBad: { backgroundColor: 'rgba(227,154,75,0.12)', borderColor: 'rgba(227,154,75,0.45)' },
  statusLabel: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.text },
  statusValue: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.muted },
  checkNote: { fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 18, color: colors.muted, paddingHorizontal: 4, marginTop: -4 },
  okText: { color: GREEN },
  badText: { color: colors.warn },
  other: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1.1, color: colors.muted, marginTop: 8, paddingLeft: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.07)' },
  chipOn: { backgroundColor: colors.text },
  chipText: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.textDim },
  chipTextOn: { color: colors.base },
  more: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.muted, textAlign: 'center', marginTop: 10 },
});
