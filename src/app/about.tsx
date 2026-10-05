import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GeometricPattern } from '@/components/GeometricPattern';
import { ChevronIcon } from '@/components/icons';
import { Group, Row } from '@/components/settings/controls';
import { useI18n } from '@/i18n';
import { colors } from '@/theme/colors';
import { fonts } from '@/theme/typography';

const APP_VERSION = Constants.expoConfig?.version ?? '';

/** „За приложението“: версия, източници на данните и поверителност. Отваря се от „Настройки“. */
export default function AboutScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const a = t.about;

  const closing = useRef(false);
  const back = () => {
    if (closing.current) return;
    closing.current = true;
    if (router.canGoBack()) router.back();
    else router.replace('/settings');
  };

  const source = (key: keyof typeof a.sources, first?: boolean) => (
    <Row first={first}>
      <View style={styles.sourceText}>
        <Text style={styles.sourceName}>{a.sources[key].name}</Text>
        <Text style={styles.sourceDesc}>{a.sources[key].desc}</Text>
      </View>
    </Row>
  );

  return (
    <View style={styles.root}>
      <GeometricPattern />
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={back} hitSlop={10} accessibilityRole="button" style={styles.backBtn}>
          <ChevronIcon direction="left" size={18} color={colors.gold} />
          <Text style={styles.backText}>{a.back}</Text>
        </Pressable>
      </View>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>أذان</Text>
          </View>
          <Text style={styles.appName}>{a.name}</Text>
          <Text style={styles.tagline}>{a.tagline}</Text>
          <Text style={styles.version}>{a.version(APP_VERSION)}</Text>
        </View>

        <Group label={a.groupTimes}>
          {source('mufti', true)}
          {source('adhan')}
        </Group>
        <Group label={a.groupPlaces}>
          {source('osm', true)}
          {source('ne')}
          {source('geonames')}
          {source('praytimes')}
        </Group>
        <Group label={a.groupMap}>
          {source('overpass', true)}
          {source('openfreemap')}
        </Group>
        <Group label={a.groupPrivacy}>
          <Row first>
            <Text style={styles.privacy}>{a.privacy}</Text>
          </Row>
        </Group>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.base },
  header: { paddingHorizontal: 16, paddingBottom: 4 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingVertical: 6 },
  backText: { fontFamily: fonts.bold, fontSize: 15, color: colors.gold },
  content: { paddingHorizontal: 16, gap: 20 },
  hero: { alignItems: 'center', paddingVertical: 12, gap: 4 },
  logo: {
    width: 84,
    height: 84,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(212,168,87,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212,168,87,0.45)',
    marginBottom: 10,
  },
  logoText: { fontFamily: fonts.arabicBold, fontSize: 30, color: colors.gold },
  appName: { fontFamily: fonts.extrabold, fontSize: 26, color: colors.text },
  tagline: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.textDim },
  version: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.muted, marginTop: 2 },
  sourceText: { flex: 1, gap: 2 },
  sourceName: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.text },
  sourceDesc: { fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 17, color: colors.muted },
  privacy: { flex: 1, fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.textDim },
});
