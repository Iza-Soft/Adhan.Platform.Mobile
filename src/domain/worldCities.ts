import type { PlaceName } from './resolve';

/**
 * Офлайн списъкът на градовете по света (без България): ~25 000 града с над 15 000 жители
 * и всички столици/областни центрове – от GeoNames (CC BY 4.0), виж tools/build-world-cities.mjs.
 *
 * За какво е:
 * - името на мястото извън България, когато телефонът не може да го даде (без интернет,
 *   Huawei без Google услуги);
 * - държавата – по нея се избира методът за изчисление (виж methodForCountry).
 */

interface WorldData {
  names: string[];
  cc: string;
  lat: number[];
  lon: number[];
  countries: Record<string, [string, string]>;
}

let data: WorldData | null = null;

/** Зарежда се при първа нужда (~600 KB) – не забавя стартирането. */
function load(): WorldData {
  if (!data) {
    const raw = require('@/data/world-cities.json') as {
      names: string;
      cc: string;
      lat: number[];
      lon: number[];
      countries: Record<string, [string, string]>;
    };
    data = { names: raw.names.split('\n'), cc: raw.cc, lat: raw.lat, lon: raw.lon, countries: raw.countries };
  }
  return data;
}

export interface WorldCity {
  name: string;
  /** ISO код на държавата: „TR“ */
  country: string;
  latitude: number;
  longitude: number;
  /** Разстояние до точката, км. */
  km: number;
}

/**
 * Докъде „стига“ градът (км) според мястото му по население: в центъра на Истанбул
 * или Берлин името е „Istanbul“ / „Berlin“, а не кварталът (Eminönü, Mitte), който е по-близо.
 */
function reachKm(rank: number): number {
  if (rank < 100) return 25; // мегаполиси
  if (rank < 1000) return 12;
  if (rank < 5000) return 6;
  return 3;
}

/**
 * Градът на точката (до `maxKm`): най-големият град, в чийто обхват е точката,
 * иначе най-близкият. Списъкът е подреден по население.
 */
export function nearestCity(lat: number, lon: number, maxKm = 50): WorldCity | null {
  const d = load();
  const cosLat = Math.cos((lat * Math.PI) / 180);
  const kmTo = (i: number) => {
    const dy = d.lat[i] / 100 - lat;
    let dLon = d.lon[i] / 100 - lon;
    if (dLon > 180) dLon -= 360;
    else if (dLon < -180) dLon += 360;
    const dx = dLon * cosLat;
    return 111.195 * Math.sqrt(dx * dx + dy * dy);
  };
  let best = -1;
  let bestKm = Infinity;
  for (let i = 0; i < d.names.length; i++) {
    const km = kmTo(i);
    // първият (най-големият) град, който „покрива“ точката, печели веднага
    if (km <= reachKm(i)) {
      best = i;
      bestKm = km;
      break;
    }
    if (km < bestKm) {
      bestKm = km;
      best = i;
    }
  }
  if (best < 0 || bestKm > maxKm) return null;
  return {
    name: d.names[best],
    country: d.cc.slice(best * 2, best * 2 + 2),
    latitude: d.lat[best] / 100,
    longitude: d.lon[best] / 100,
    km: bestKm,
  };
}

/** Държавата на точката – по най-близкия град (до 600 км: и в открито море, и в пустинята). */
export function countryAt(lat: number, lon: number): string | null {
  return nearestCity(lat, lon, 600)?.country ?? null;
}

/** „Турция“ / „Türkiye“; непозната – самият код. */
export function countryName(code: string, lang: 'bg' | 'en'): string {
  const n = load().countries[code.toUpperCase()];
  return n ? n[lang === 'bg' ? 0 : 1] : code.toUpperCase();
}

/**
 * Име на мястото без интернет: градът и държавата („Istanbul“ / „Турция“).
 * null – няма град наблизо (тогава остават координатите).
 */
export function offlinePlaceName(lat: number, lon: number): PlaceName | null {
  const city = nearestCity(lat, lon);
  if (!city) return null;
  return {
    names: { bg: city.name, en: city.name },
    detail: { bg: countryName(city.country, 'bg'), en: countryName(city.country, 'en') },
  };
}
