import { PlaceholderScreen } from '@/components/PlaceholderScreen';
import { useI18n } from '@/i18n';

export default function SettingsScreen() {
  const { t } = useI18n();
  return <PlaceholderScreen title={t.tabs.settings} note={t.placeholder.settings} />;
}
