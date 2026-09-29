import { PlaceholderScreen } from '@/components/PlaceholderScreen';
import { useI18n } from '@/i18n';

export default function MonthScreen() {
  const { t } = useI18n();
  return <PlaceholderScreen title={t.tabs.month} note={t.placeholder.month} />;
}
