import type { BottomTabBarProps } from 'expo-router/js-tabs';
import type { ComponentType } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/theme/colors';
import { FONT_SCALE, fonts } from '@/theme/typography';

import { MonthIcon, MosqueIcon, QiblaIcon, SettingsIcon, TodayIcon } from './icons';

const ICONS: Record<string, ComponentType<{ color: string }>> = {
  index: TodayIcon,
  qibla: QiblaIcon,
  mosques: MosqueIcon,
  month: MonthIcon,
  settings: SettingsIcon,
};

const BAR_HEIGHT = 58;

/** Височината на лентата + долния безопасен отстъп. Екраните я ползват за padding отдолу. */
export function useTabBarHeight() {
  const insets = useSafeAreaInsets();
  return BAR_HEIGHT + Math.max(insets.bottom, 12);
}

/**
 * Собствена долна навигация. Позиционирана е `absolute`, за да минава
 * градиентът на екрана под нея, както в mockup-а.
 */
export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const { options } = descriptors[route.key];
        const label = options.title ?? route.name;
        const Icon = ICONS[route.name] ?? TodayIcon;
        const color = focused ? colors.gold : colors.muted;

        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
        };

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            style={styles.item}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={label}
          >
            <Icon color={color} />
            <Text maxFontSizeMultiplier={FONT_SCALE.dense} numberOfLines={1} style={[styles.label, { color }]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    paddingTop: 8,
    paddingHorizontal: 8,
    backgroundColor: colors.tabBar,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.10)',
  },
  item: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 4 },
  // 5 раздела: „Настройки“ / „Ayarlar“ трябва да се побират и на тесен телефон
  label: { fontFamily: fonts.semibold, fontSize: 10.5 },
});
