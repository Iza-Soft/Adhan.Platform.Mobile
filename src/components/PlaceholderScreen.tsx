import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/theme/colors';
import { fonts } from '@/theme/typography';

import { GeometricPattern } from './GeometricPattern';

/** Временен екран за табовете, които идват в следващите етапи. */
export function PlaceholderScreen({ title, note }: { title: string; note: string }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, { paddingTop: insets.top + 12 }]}>
      <GeometricPattern />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.note}>{note}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.base, paddingHorizontal: 20, gap: 8 },
  title: { fontFamily: fonts.extrabold, fontSize: 26, color: colors.text },
  note: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, color: colors.muted },
});
