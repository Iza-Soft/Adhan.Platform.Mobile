import type { PlaceName } from './resolve';

/**
 * Полетата от обратното геокодиране на телефона, които ни трябват
 * (подмножество на LocationGeocodedAddress от expo-location).
 * Android (Google): city = locality, district = subLocality, subregion = subAdminArea, region = adminArea.
 * iOS (Apple):      city = locality, district = subLocality, subregion = subAdministrativeArea, region = administrativeArea.
 */
export interface GeocodedAddress {
  city?: string | null;
  district?: string | null;
  subregion?: string | null;
  region?: string | null;
  country?: string | null;
  isoCountryCode?: string | null;
}

/** За сравнение: без главни букви и диакритика („İstanbul“ = „Istanbul“). */
function norm(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ı/g, 'i')
    .toLowerCase()
    .trim();
}

function clean(s: string | null | undefined): string | null {
  const t = s?.trim();
  return t ? t : null;
}

/** Първата стойност, която я има и не е (част от) името на града. */
function firstOther(main: string, values: (string | null | undefined)[]): string | null {
  const m = norm(main);
  for (const v of values) {
    const c = clean(v);
    if (!c) continue;
    const n = norm(c);
    if (n === m || n.includes(m) || m.includes(n)) continue; // „City of Edinburgh“ до „Edinburgh“
    return c;
  }
  return null;
}

/**
 * Име на място извън България: на първия ред винаги градът,
 * на втория – районът (ако го има) и държавата: „İstanbul“ / „Fatih, Türkiye“.
 *
 * Турция е отделен случай: там областта (il) е градът, а „city“ от
 * геокодирането често е районът (ilçe) – в Истанбул Android връща „Fatih“.
 * Затова за Турция градът е region, а районът – subregion или city.
 * Другаде градът е city (ако го няма – subregion, после region),
 * а районът – district (квартал / част от града).
 */
export function nameFromAddress(addr: GeocodedAddress | null | undefined): PlaceName | null {
  if (!addr) return null;
  const turkey = addr.isoCountryCode?.toUpperCase() === 'TR';

  const city = turkey
    ? clean(addr.region) ?? clean(addr.city) ?? clean(addr.subregion)
    : clean(addr.city) ?? clean(addr.subregion) ?? clean(addr.region);
  if (!city) return null;

  // „Merkez“ („център“) е името на централния район на всеки турски град – не казва нищо
  const district = turkey
    ? firstOther(city, [addr.subregion, addr.city, addr.district].filter((v) => norm(v ?? '') !== 'merkez'))
    : firstOther(city, [addr.district]);
  const country = clean(addr.country);

  const second = [district, country].filter(Boolean).join(', ');
  return {
    names: { bg: city, en: city },
    detail: second ? { bg: second, en: second } : undefined,
  };
}
