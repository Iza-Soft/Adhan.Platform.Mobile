import { router } from 'expo-router';
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PinIcon } from '@/components/icons';
import {
  allCities,
  isSearchIndexReady,
  placeToLocation,
  searchPlaces,
  warmSearchIndex,
  type Place,
} from '@/domain/places';
import { useI18n } from '@/i18n';
import { refreshLocation } from '@/services/location';
import { useSettings } from '@/store/settings';
import { colors } from '@/theme/colors';
import { fonts } from '@/theme/typography';

/** Избор на населено място в България с търсене (модален екран). */
export default function PlaceScreen() {
  const insets = useSafeAreaInsets();
  const { lang, t } = useI18n();
  const chooseLocation = useSettings((s) => s.chooseLocation);
  const setAutoLocation = useSettings((s) => s.setAutoLocation);
  const [query, setQuery] = useState('');
  // Полето за писане се обновява веднага, а списъкът – когато JS е свободен.
  const deferredQuery = useDeferredValue(query);
  const searching = deferredQuery.trim().length >= 2;
  const results = useMemo(() => (searching ? searchPlaces(deferredQuery) : allCities()), [searching, deferredQuery]);

  // Индексът за търсене се строи на части, докато потребителят още не е започнал да пише.
  const [indexReady, setIndexReady] = useState(isSearchIndexReady);
  useEffect(() => {
    let alive = true;
    warmSearchIndex().then(() => alive && setIndexReady(true));
    return () => {
      alive = false;
    };
  }, []);
  // „Мисля“: написаното още не е стигнало до списъка или индексът не е готов.
  const busy = query.trim().length >= 2 && (!indexReady || query !== deferredQuery);

  // Затваря екрана само веднъж: повторно натискане на „Затвори“ (или избор + „Затвори“)
  // иначе праща второ „назад“, когато вече няма накъде – грешката GO_BACK.
  const closing = useRef(false);
  const close = () => {
    if (closing.current) return;
    closing.current = true;
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const pick = (p: Place) => {
    chooseLocation(placeToLocation(p));
    close();
  };

  const onUseGps = () => {
    setAutoLocation(true);
    refreshLocation();
    close();
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 10 }]}>
      <View style={styles.header}>
        <Text style={styles.title}>{t.place.title}</Text>
        <Pressable onPress={close} hitSlop={10} accessibilityRole="button">
          <Text style={styles.close}>{t.place.close}</Text>
        </Pressable>
      </View>

      <View>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder={t.place.search}
        placeholderTextColor={colors.muted}
        autoFocus
        autoCorrect={false}
        style={styles.input}
        returnKeyType="search"
        accessibilityLabel={t.place.search}
      />
      {busy && (
        <ActivityIndicator
          size="small"
          color={colors.gold}
          style={styles.inputSpinner}
          accessibilityLabel={t.busy}
        />
      )}
      </View>

      <Pressable onPress={onUseGps} style={({ pressed }) => [styles.gpsRow, pressed && styles.pressed]} accessibilityRole="button">
        <PinIcon size={18} color={colors.gold} />
        <Text style={styles.gpsText}>{t.place.useGps}</Text>
      </Pressable>

      <FlatList
        data={results}
        keyExtractor={(p) => String(p.index)}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        ListHeaderComponent={
          !searching ? <Text style={styles.section}>{t.place.cities.toUpperCase()}</Text> : null
        }
        ListEmptyComponent={<Text style={styles.empty}>{t.place.noResults}</Text>}
        ListFooterComponent={<Text style={styles.footer}>{t.place.abroadNote}</Text>}
        renderItem={({ item }) => {
          const loc = placeToLocation(item);
          return (
            <Pressable
              onPress={() => pick(item)}
              style={({ pressed }) => [styles.item, pressed && styles.pressed]}
              accessibilityRole="button"
            >
              <Text style={styles.itemName}>{loc.names[lang]}</Text>
              <Text style={styles.itemDetail}>{loc.detail?.[lang]}</Text>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.base, paddingHorizontal: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  title: { fontFamily: fonts.extrabold, fontSize: 22, color: colors.text },
  close: { fontFamily: fonts.bold, fontSize: 14, color: colors.gold },
  input: {
    height: 46,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingRight: 44, // място за индикатора
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    color: colors.text,
    fontFamily: fonts.medium,
    fontSize: 15,
  },
  inputSpinner: { position: 'absolute', right: 14, top: 0, bottom: 0 },
  gpsRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14, paddingHorizontal: 4 },
  gpsText: { fontFamily: fonts.bold, fontSize: 14, color: colors.gold },
  pressed: { backgroundColor: 'rgba(255,255,255,0.04)' },
  section: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1.1, color: colors.muted, marginTop: 4, marginBottom: 4 },
  item: {
    paddingVertical: 11,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  itemName: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  itemDetail: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.muted, marginTop: 1 },
  empty: { fontFamily: fonts.medium, fontSize: 14, color: colors.muted, paddingVertical: 20, textAlign: 'center' },
  footer: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, paddingVertical: 16, textAlign: 'center' },
});
