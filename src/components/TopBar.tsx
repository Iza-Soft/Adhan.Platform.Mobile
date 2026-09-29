import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useI18n } from '@/i18n';
import { colors } from '@/theme/colors';
import { fonts } from '@/theme/typography';

import { ChevronDownIcon, PinIcon } from './icons';

interface Props {
  city: string;
  gregorian: string;
  hijri: string;
  onCityPress?: () => void;
}

export function TopBar({ city, gregorian, hijri, onCityPress }: Props) {
  const { t } = useI18n();
  return (
    <View style={styles.bar}>
      <Pressable
        onPress={onCityPress}
        style={({ pressed }) => [styles.city, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={t.a11y.city(city)}
      >
        <PinIcon color={colors.text} />
        <Text style={styles.cityText}>{city}</Text>
        <ChevronDownIcon color={colors.text} />
      </Pressable>
      <View style={styles.dates}>
        <Text style={styles.gregorian}>{gregorian}</Text>
        <Text style={styles.hijri}>{hijri}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 4,
    gap: 8,
  },
  city: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingLeft: 10,
    paddingRight: 12,
    borderRadius: 999,
    backgroundColor: colors.pill,
  },
  pressed: { opacity: 0.7 },
  cityText: { fontFamily: fonts.bold, fontSize: 14, color: colors.text },
  dates: { alignItems: 'flex-end', flexShrink: 1 },
  gregorian: { fontFamily: fonts.bold, fontSize: 12, lineHeight: 16, color: colors.text },
  hijri: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, color: colors.textDim },
});
