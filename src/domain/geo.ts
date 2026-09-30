import border from '@/data/bulgaria-border.json';

/**
 * Проверка „в България ли е тази точка“ – без интернет.
 * Границата е от Natural Earth 1:10m (public domain), опростена до ~200 м (≈10 KB).
 */
const RING: readonly (readonly number[])[] = border.ring; // [дължина, ширина]

export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

/**
 * Бързо разстояние за търсене на най-близкото място: равноъгълна проекция,
 * без тригонометрия в цикъла (cosLat се смята веднъж за точката).
 * На разстояния до стотина км грешката е под 0,5 % – за избор на населено място е без значение.
 */
export function fastKm(lat1: number, lon1: number, lat2: number, lon2: number, cosLat: number): number {
  const dy = lat2 - lat1;
  const dx = (lon2 - lon1) * cosLat;
  return 111.195 * Math.sqrt(dx * dx + dy * dy);
}

/** Правоъгълникът около България (с ~5 км запас): извън него точката със сигурност не е в България. */
export function nearBulgaria(lat: number, lon: number): boolean {
  return lat > 41.18 && lat < 44.27 && lon > 22.3 && lon < 28.7;
}

/** Класическият алгоритъм „лъч“: броим колко пъти хоризонтален лъч пресича границата. */
export function insideBorder(lat: number, lon: number): boolean {
  let inside = false;
  for (let i = 0, j = RING.length - 1; i < RING.length; j = i++) {
    const [xi, yi] = RING[i];
    const [xj, yj] = RING[j];
    const crosses = yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}
