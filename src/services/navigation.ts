import { Linking, Platform } from 'react-native';

import { appIcon, isAppInstalled, openInApp } from '../../modules/adhan-native';

import {
  modeFor,
  navApp,
  navAppsFor,
  navUrl,
  storeUrl,
  storeWebUrl,
  type Destination,
  type NavApp,
  type NavAppId,
  type NavPlatform,
  type Origin,
  type TravelMode,
} from '@/domain/navApps';

/**
 * Отваряне на „Упътване“ в избраното приложение за навигация (етап 12).
 * Android: точно в приложението (Intent с пакет) – проверката „инсталирано ли е“ е в native частта
 * (пакетите са изброени в <queries> в AndroidManifest.xml).
 * iPhone: по схемата на приложението (LSApplicationQueriesSchemes в app.json).
 */

export const navPlatform: NavPlatform = Platform.OS === 'ios' ? 'ios' : 'android';

/** Приложенията за този телефон. */
export function availableNavApps(): NavApp[] {
  return navAppsFor(navPlatform);
}

/**
 * Инсталирано ли е. „Автоматично“ и Apple Maps – винаги.
 * HERE WeGo на iPhone няма схема за проверка – връзката е https и без приложението се отваря в браузъра.
 */
export async function isInstalled(id: NavAppId): Promise<boolean> {
  const app = navApp(id);
  if (id === 'auto' || id === 'apple') return true;
  if (navPlatform === 'android') {
    if (!app.androidPackage) return false;
    return isAppInstalled(app.androidPackage) ?? true; // стар build без native частта – не знаем
  }
  if (!app.iosScheme) return id === 'here';
  return Linking.canOpenURL(`${app.iosScheme}://`).catch(() => false);
}

/** Кои приложения са инсталирани – за списъка в Настройки и листа „Отвори с…“. */
export async function installedMap(): Promise<Partial<Record<NavAppId, boolean>>> {
  const apps = availableNavApps();
  const values = await Promise.all(apps.map((a) => isInstalled(a.id)));
  return Object.fromEntries(apps.map((a, i) => [a.id, values[i]]));
}

const icons = new Map<string, string | null>();

/** Истинската икона на приложението (Android) като data: URI; null – буквата на плочката. */
export function navAppIcon(id: NavAppId): string | null {
  const pkg = navApp(id).androidPackage;
  if (navPlatform !== 'android' || !pkg) return null;
  if (!icons.has(pkg)) {
    const b64 = appIcon(pkg, 96);
    icons.set(pkg, b64 ? `data:image/png;base64,${b64}` : null);
  }
  return icons.get(pkg) ?? null;
}

async function open(url: string, pkg: string | null): Promise<boolean> {
  if (navPlatform === 'android') {
    const r = openInApp(url, pkg);
    if (r !== null) return r;
  }
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Отваря упътването. 'missing' – приложението вече го няма (изтрито) → питаме отново.
 * Режимът: пеша за близките джамии, с кола за далечните; Waze – винаги с кола.
 */
export async function openDirections(
  id: NavAppId,
  to: Destination,
  wanted: TravelMode,
  from?: Origin | null,
): Promise<'ok' | 'missing'> {
  const app = navApp(id);
  const mode = modeFor(id, wanted);
  if (id !== 'auto' && id !== 'apple' && !(await isInstalled(id))) return 'missing';

  const url = navUrl(id, navPlatform, to, mode, from);
  if (await open(url, app.androidPackage ?? null)) return 'ok';

  if (id === 'auto') {
    // на телефона няма нито едно приложение за карти – Google Maps в браузъра
    const travel = mode === 'walk' ? 'walking' : 'driving';
    const web = `https://www.google.com/maps/dir/?api=1&destination=${to.lat.toFixed(6)},${to.lon.toFixed(6)}&travelmode=${travel}`;
    return (await open(web, null)) ? 'ok' : 'missing';
  }
  return 'missing';
}

/** Магазинът за приложението (Google Play / App Store); без Google Play (Huawei) – уеб страницата. */
export async function openStore(id: NavAppId): Promise<void> {
  const app = navApp(id);
  const url = storeUrl(app, navPlatform);
  if (!url) return;
  try {
    await Linking.openURL(url);
  } catch {
    const web = storeWebUrl(app);
    if (web) await Linking.openURL(web).catch(() => {});
  }
}

/** Връзка към мястото за „Сподели“ – отваря се в картите на всеки телефон. */
export function placeLink(lat: number, lon: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat.toFixed(6)},${lon.toFixed(6)}`;
}
