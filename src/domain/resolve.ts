import { formatCoords, type AppLocation } from './location';
import { isInBulgaria, placeAt, placeToLocation } from './places';

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
export function locationFromCoords(lat: number, lon: number, abroadName?: PlaceName | null): AppLocation {
  if (isInBulgaria(lat, lon)) return placeToLocation(placeAt(lat, lon));
  const coords = formatCoords(lat, lon);
  return {
    id: `gps:${lat.toFixed(3)},${lon.toFixed(3)}`,
    names: abroadName?.names ?? { bg: coords, en: coords },
    detail: abroadName?.detail,
    latitude: lat,
    longitude: lon,
    source: 'calc',
  };
}
