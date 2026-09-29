import type { PrayerId } from '@/domain/prayers';

/** Три цвята за всяка молитва: горе → среда (55%) → долу. */
export type GradientStops = readonly [string, string, string];

export const PHASE_GRADIENTS: Record<PrayerId, GradientStops> = {
  fajr: ['#14132C', '#3A2A57', '#9A6079'], // зора: лилаво → розово
  sunrise: ['#111F35', '#2E4F72', '#C98E62'], // утро: синьо → праскова
  dhuhr: ['#0D2A47', '#1E5A86', '#5B98C0'], // пладне: небесно синьо
  asr: ['#1B1712', '#4F3C1F', '#B48437'], // следобед: кехлибар
  maghrib: ['#1B1023', '#672838', '#CC6139'], // залез: бордо → оранжево
  isha: ['#070A1B', '#131941', '#2A2C66'], // нощ: индиго
};

export const GRADIENT_LOCATIONS = [0, 0.55, 1] as const;
