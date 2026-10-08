/**
 * Приложенията за навигация (етап 12) – с кое се отваря „Упътване“ до джамия.
 * Собствена навигация няма: даваме координатите на избраното приложение.
 *
 * Връзките са проверени по документацията на всяко приложение (10.2026):
 * - Google Maps – google.navigation: (Android), comgooglemaps:// (iPhone), резерва https://www.google.com/maps/dir/
 * - Waze – https://waze.com/ul?ll=…&navigate=yes; няма режим пеша (само с кола)
 * - HERE WeGo – https://share.here.com/r/mylocation/…?m=w|d
 * - Petal Maps (Huawei, само Android) – petalmaps://route?daddr=…&type=walk|drive&coordinateType=0
 *   (без coordinateType=0 координатите се четат в китайската система GCJ02)
 * - Organic Maps – om://route?sll=…&saddr=…&dll=…&daddr=…&type=pedestrian|vehicle
 *   (иска и началната точка, параметрите – точно в този ред)
 * - Apple Maps (iPhone) – https://maps.apple.com/directions?destination=…&mode=walking|driving (iOS 18.4+)
 * - Автоматично: Android – geo: (телефонът пита или отваря картите по подразбиране); iPhone – Apple Maps
 */

export type NavAppId = 'auto' | 'google' | 'waze' | 'here' | 'petal' | 'organic' | 'apple';
export type NavPlatform = 'android' | 'ios';
export type TravelMode = 'walk' | 'drive';

export interface NavApp {
  id: NavAppId;
  /** Името (марките не се превеждат); за 'auto' – от текстовете на приложението. */
  name: string;
  /** Буквата на плочката, докато няма истинска икона. */
  letter: string;
  /** Тъмен цвят на плочката. */
  color: string;
  /** Може ли да води пеша. */
  walking: boolean;
  platforms: readonly NavPlatform[];
  /** Android: пакетът – за проверка дали е инсталирано и за отваряне точно в него. */
  androidPackage?: string;
  /** iPhone: схемата за проверка дали е инсталирано (LSApplicationQueriesSchemes). */
  iosScheme?: string;
  /** App Store. */
  iosStore?: string;
}

export const NAV_APPS: readonly NavApp[] = [
  { id: 'auto', name: '', letter: 'A', color: '#3A4A63', walking: true, platforms: ['android', 'ios'] },
  {
    id: 'google',
    name: 'Google Maps',
    letter: 'G',
    color: '#3E6B5A',
    walking: true,
    platforms: ['android', 'ios'],
    androidPackage: 'com.google.android.apps.maps',
    iosScheme: 'comgooglemaps',
    iosStore: 'https://apps.apple.com/app/id585027354',
  },
  {
    id: 'waze',
    name: 'Waze',
    letter: 'W',
    color: '#3F6A86',
    walking: false,
    platforms: ['android', 'ios'],
    androidPackage: 'com.waze',
    iosScheme: 'waze',
    iosStore: 'https://apps.apple.com/app/id323229106',
  },
  {
    id: 'here',
    name: 'HERE WeGo',
    letter: 'H',
    color: '#4B4F7A',
    walking: true,
    platforms: ['android', 'ios'],
    androidPackage: 'com.here.app.maps',
    iosStore: 'https://apps.apple.com/app/id955837609',
  },
  {
    id: 'petal',
    name: 'Petal Maps',
    letter: 'P',
    color: '#7A4B4B',
    walking: true,
    platforms: ['android'],
    androidPackage: 'com.huawei.maps.app',
  },
  {
    id: 'organic',
    name: 'Organic Maps',
    letter: 'O',
    color: '#4F6B3A',
    walking: true,
    platforms: ['android', 'ios'],
    androidPackage: 'app.organicmaps',
    iosScheme: 'om',
    iosStore: 'https://apps.apple.com/app/id1567437057',
  },
  { id: 'apple', name: 'Apple Maps', letter: 'A', color: '#4A5568', walking: true, platforms: ['ios'] },
];

export function navAppsFor(platform: NavPlatform): NavApp[] {
  // на iPhone „Автоматично“ е Apple Maps – отделен ред „Apple Maps“ би бил същото
  return NAV_APPS.filter((a) => a.platforms.includes(platform) && !(platform === 'ios' && a.id === 'apple'));
}

export function navApp(id: NavAppId): NavApp {
  return NAV_APPS.find((a) => a.id === id) ?? NAV_APPS[0];
}

export interface Destination {
  lat: number;
  lon: number;
  name: string;
}

export interface Origin {
  lat: number;
  lon: number;
  name: string;
}

const c = (n: number) => n.toFixed(6);
const enc = encodeURIComponent;

/**
 * Връзката за упътване. Режимът: пеша за близките джамии, с кола за далечните;
 * приложение без режим пеша (Waze) – винаги с кола.
 */
export function navUrl(
  id: NavAppId,
  platform: NavPlatform,
  to: Destination,
  mode: TravelMode,
  from?: Origin | null,
): string {
  const ll = `${c(to.lat)},${c(to.lon)}`;
  const walk = mode === 'walk';
  switch (id) {
    case 'google':
      return platform === 'android'
        ? `google.navigation:q=${ll}&mode=${walk ? 'w' : 'd'}`
        : `comgooglemaps://?daddr=${ll}&directionsmode=${walk ? 'walking' : 'driving'}`;
    case 'waze':
      return `https://waze.com/ul?ll=${ll}&navigate=yes&utm_source=ezan`;
    case 'here':
      return `https://share.here.com/r/mylocation/${ll},${enc(to.name)}?m=${walk ? 'w' : 'd'}`;
    case 'petal':
      return `petalmaps://route?daddr=${ll}&type=${walk ? 'walk' : 'drive'}&coordinateType=0&utm_source=com.ilkoadamov.hayya`;
    case 'organic':
      // без началната точка Organic Maps отхвърля връзката – тогава само показва мястото
      return from
        ? `om://route?sll=${c(from.lat)},${c(from.lon)}&saddr=${enc(from.name)}&dll=${ll}&daddr=${enc(to.name)}&type=${walk ? 'pedestrian' : 'vehicle'}`
        : `om://map?ll=${ll}&n=${enc(to.name)}`;
    case 'apple':
      return `https://maps.apple.com/directions?destination=${ll}&mode=${walk ? 'walking' : 'driving'}`;
    case 'auto':
    default:
      return platform === 'android'
        ? `geo:0,0?q=${ll}(${enc(to.name)})`
        : `https://maps.apple.com/directions?destination=${ll}&mode=${walk ? 'walking' : 'driving'}`;
  }
}

/** Режимът за приложението: Waze – само с кола. */
export function modeFor(id: NavAppId, wanted: TravelMode): TravelMode {
  return navApp(id).walking ? wanted : 'drive';
}

/** Къде да се изтегли приложението. */
export function storeUrl(app: NavApp, platform: NavPlatform): string | null {
  if (platform === 'android') return app.androidPackage ? `market://details?id=${app.androidPackage}` : null;
  return app.iosStore ?? null;
}

/** Резерва, ако магазинът не се отвори (няма Google Play – Huawei). */
export function storeWebUrl(app: NavApp): string | null {
  return app.androidPackage ? `https://play.google.com/store/apps/details?id=${app.androidPackage}` : null;
}
