import { distanceKm } from './geo';

/**
 * Джамиите наблизо (етап 12) – данните от OpenStreetMap (Overpass API):
 * `amenity=place_of_worship` + `religion=muslim` – джамии и месджиди (и по-малките
 * молитвени помещения, ако са отбелязани). Тук е само чистата логика: заявката, разчитането
 * на отговора, разстоянието, посоката и времето пеша. Мрежата и кешът – src/services/mosques.ts.
 */

/** Първо търсим до 2 км; „Търси до 10 км“ – по-далечните. */
export const NEAR_RADIUS_M = 2000;
export const FAR_RADIUS_M = 10000;
/** До това разстояние упътването е пеша, над него – с кола. */
export const WALK_LIMIT_M = 2500;

export interface Mosque {
  /** „node/123“, „way/456“ – уникално в OSM. */
  id: string;
  /** Името на езика на приложението, иначе местното; null – няма име в OSM. */
  name: string | null;
  /** Името на арабски (name:ar), ако го има и се различава. */
  arabic: string | null;
  lat: number;
  lon: number;
  /** „Yeni Cami Cd. 3, Fatih“ – от addr:*; null – няма адрес. */
  address: string | null;
}

export interface NearMosque extends Mosque {
  /** Разстояние по права линия, м. */
  distanceM: number;
  /** Посока от теб към джамията, градуси от север. */
  bearing: number;
  /** Пеша (до WALK_LIMIT_M) или с кола. */
  mode: 'walk' | 'drive';
  /** Приблизително време, мин. */
  minutes: number;
}

/**
 * Какво отива към Overpass: районът е закръглен до ~1 км (2 знака след запятаята)
 * и радиусът е увеличен с 1,5 км – точното място остава в телефона, а резултатите
 * се филтрират тук по истинското разстояние.
 */
export function privacyArea(lat: number, lon: number, radiusM: number): { lat: number; lon: number; radiusM: number } {
  return { lat: Math.round(lat * 100) / 100, lon: Math.round(lon * 100) / 100, radiusM: radiusM + 1500 };
}

/** Заявката към Overpass (Overpass QL). `out center` дава точка и за сградите (way). */
export function overpassQuery(lat: number, lon: number, radiusM: number): string {
  const a = privacyArea(lat, lon, radiusM);
  return (
    `[out:json][timeout:25];` +
    `nwr["amenity"="place_of_worship"]["religion"="muslim"](around:${a.radiusM},${a.lat},${a.lon});` +
    `out center tags;`
  );
}

interface OsmElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

/** Адресът от addr:* – улица и номер, квартал/град. */
function addressOf(tags: Record<string, string>): string | null {
  const street = [tags['addr:street'], tags['addr:housenumber']].filter(Boolean).join(' ');
  const area = tags['addr:suburb'] ?? tags['addr:district'] ?? tags['addr:city'] ?? tags['addr:place'];
  const line = [street || tags['addr:place'], street ? area : null].filter(Boolean).join(', ');
  return line || null;
}

/** Отговорът на Overpass → джамии. `lang` – езикът на приложението (за name:bg / name:en / name:tr). */
export function parseOverpass(json: unknown, lang: string): Mosque[] {
  const elements = (json as { elements?: OsmElement[] })?.elements;
  if (!Array.isArray(elements)) return [];
  const out: Mosque[] = [];
  const seen = new Set<string>();
  for (const e of elements) {
    const lat = e.lat ?? e.center?.lat;
    const lon = e.lon ?? e.center?.lon;
    if (typeof lat !== 'number' || typeof lon !== 'number') continue;
    const id = `${e.type}/${e.id}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const tags = e.tags ?? {};
    const name = tags[`name:${lang}`] ?? tags.name ?? tags['name:en'] ?? null;
    const ar = tags['name:ar'] ?? null;
    out.push({
      id,
      name: name?.trim() || null,
      arabic: ar && ar !== name ? ar.trim() : null,
      lat,
      lon,
      address: addressOf(tags),
    });
  }
  return out;
}

/** Посоката от точка A към B, градуси от север (0–360). */
export function bearingDeg(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const rad = Math.PI / 180;
  const y = Math.sin((lon2 - lon1) * rad) * Math.cos(lat2 * rad);
  const x =
    Math.cos(lat1 * rad) * Math.sin(lat2 * rad) - Math.sin(lat1 * rad) * Math.cos(lat2 * rad) * Math.cos((lon2 - lon1) * rad);
  return (Math.atan2(y, x) / rad + 360) % 360;
}

/**
 * Приблизително време: улиците не са права линия – ×1,3; пеша 4,8 км/ч (80 м/мин),
 * с кола в града ~30 км/ч (500 м/мин). Точното време дава приложението за навигация.
 */
export function travelMinutes(distanceM: number, mode: 'walk' | 'drive'): number {
  const road = distanceM * 1.3;
  return Math.max(1, Math.round(road / (mode === 'walk' ? 80 : 500)));
}

/** Джамиите около точката до `radiusM`, подредени по разстояние. */
export function nearMosques(all: readonly Mosque[], lat: number, lon: number, radiusM: number): NearMosque[] {
  return all
    .map((m) => {
      const distanceM = Math.round(distanceKm(lat, lon, m.lat, m.lon) * 1000);
      const mode: 'walk' | 'drive' = distanceM <= WALK_LIMIT_M ? 'walk' : 'drive';
      return { ...m, distanceM, bearing: bearingDeg(lat, lon, m.lat, m.lon), mode, minutes: travelMinutes(distanceM, mode) };
    })
    .filter((m) => m.distanceM <= radiusM)
    .sort((a, b) => a.distanceM - b.distanceM);
}

/** „350 м“, „1,4 км“, „12 км“ (на английски – с точка и „m/km“, на турски – със запетая и „m/km“). */
export function formatDistance(m: number, lang: string): string {
  const unitM = lang === 'bg' ? 'м' : 'm';
  const unitKm = lang === 'bg' ? 'км' : 'km';
  if (m < 1000) return `${Math.round(m / 10) * 10} ${unitM}`;
  const km = m / 1000;
  const text = km < 10 ? km.toFixed(1) : String(Math.round(km));
  return `${lang === 'en' ? text : text.replace('.', ',')} ${unitKm}`;
}

/** Може ли кешираният резултат да се ползва за това място и радиус. */
export function cacheCovers(
  cache: { lat: number; lon: number; radiusM: number; at: number } | null | undefined,
  lat: number,
  lon: number,
  radiusM: number,
  now: number,
  maxAgeMs = 24 * 3600_000,
): boolean {
  if (!cache) return false;
  if (now - cache.at > maxAgeMs) return false;
  // кешът е за кръг около закръглената точка с радиус cache.radiusM (вече с +1,5 км)
  const d = distanceKm(cache.lat, cache.lon, lat, lon) * 1000;
  return d + radiusM <= cache.radiusM;
}
