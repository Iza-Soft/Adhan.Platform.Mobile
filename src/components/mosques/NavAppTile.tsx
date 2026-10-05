import { Image, StyleSheet, Text, View } from 'react-native';

import { navApp, type NavAppId } from '@/domain/navApps';
import { navAppIcon } from '@/services/navigation';
import { fonts } from '@/theme/typography';

import { NavigateIcon } from '../icons';

/**
 * Плочката на приложението за навигация: на Android – истинската икона (ако е инсталирано),
 * иначе цветна плочка с буквата. „Автоматично“ – стрелката за навигация.
 */
export function NavAppTile({ id, size = 40, dim }: { id: NavAppId; size?: number; dim?: boolean }) {
  const app = navApp(id);
  const icon = dim ? null : navAppIcon(id);
  const radius = Math.round(size * 0.3);
  if (icon) {
    return <Image source={{ uri: icon }} style={{ width: size, height: size, borderRadius: radius }} accessibilityIgnoresInvertColors />;
  }
  return (
    <View
      style={[
        styles.tile,
        { width: size, height: size, borderRadius: radius, backgroundColor: app.color },
        dim && styles.dim,
      ]}
    >
      {id === 'auto' ? (
        <NavigateIcon size={Math.round(size * 0.48)} color="#F2EFE8" />
      ) : (
        <Text style={[styles.letter, { fontSize: Math.round(size * 0.42) }]}>{app.letter}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { alignItems: 'center', justifyContent: 'center' },
  dim: { opacity: 0.55 },
  letter: { fontFamily: fonts.extrabold, color: '#F2EFE8' },
});
