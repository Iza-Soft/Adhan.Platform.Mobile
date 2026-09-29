import { PlaceholderScreen } from '@/components/PlaceholderScreen';
import { useI18n } from '@/i18n';

export default function QiblaScreen() {
  const { t } = useI18n();
  return <PlaceholderScreen title={t.tabs.qibla} note={t.placeholder.qibla} />;
}
