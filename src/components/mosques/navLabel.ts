import { navApp, type NavApp, type NavAppId } from '@/domain/navApps';
import type { Strings } from '@/i18n';
import { navPlatform } from '@/services/navigation';

/** „Waze“, „Google Maps“; „Автоматично“ – на езика на приложението. */
export function navAppName(id: NavAppId, t: Strings): string {
  return id === 'auto' ? t.nav.auto : navApp(id).name;
}

/** Описанието под името: „Пеша и с кола“, „Само с кола“, „… · не е инсталирано“. */
export function navAppDesc(app: NavApp, installed: boolean, t: Strings): string {
  const n = t.nav;
  if (app.id === 'auto') return navPlatform === 'ios' ? n.autoIos : n.autoAndroid;
  const base = app.id === 'organic' ? n.organic : app.walking ? n.walkDrive : n.driveOnly;
  const extra = app.id === 'petal' ? ` · ${n.huawei}` : '';
  return installed ? base + extra : `${base}${extra} · ${n.notInstalled}`;
}
