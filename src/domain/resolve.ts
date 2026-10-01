import { formatCoords, type AppLocation } from './location';
import { isInBulgaria, placeAt, placeToLocation } from './places';
import { countryAt } from './worldCities';

export interface PlaceName {
  names: { bg: string; en: string };
  detail?: { bg: string; en: string };
}

/**
 * От координати (GPS) към място с правилния източник на часове:
 * - в България – населеното място, в което си (виж placeAt), и календарът на Мюфтийството;
 * - извън България – изчисление за точните координати; името идва отвън
 *   (обратно геокодиране от телефона), а без интернет – координатите.
 */
export function locationFromCoords(
  lat: number,
  lon: number,
  abroadName?: PlaceName | null,
  country?: string | null,
): AppLocation {
  if (isInBulgaria(lat, lon)) return placeToLocation(placeAt(lat, lon));
  const coords = formatCoords(lat, lon);
  return {
    id: `gps:${lat.toFixed(3)},${lon.toFixed(3)}`,
    names: abroadName?.names ?? { bg: coords, en: coords },
    detail: abroadName?.detail,
    latitude: lat,
    longitude: lon,
    source: 'calc',
    country: (country ?? countryAt(lat, lon) ?? undefined)?.toUpperCase(),
  };
}

const countryCache = new Map<string, string | null>();

/** Държавата на мястото: от записа, а в старите записи – по координатите (офлайн списъка). */
export function countryOf(location: AppLocation): string | null {
  if (location.source === 'mufti') return 'BG';
  if (location.country) return location.country;
  if (!countryCache.has(location.id)) countryCache.set(location.id, countryAt(location.latitude, location.longitude));
  return countryCache.get(location.id) ?? null;
}
