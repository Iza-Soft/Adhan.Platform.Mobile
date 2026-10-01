import { qiblaBearing } from '../qibla';
import { sunAtAzimuth, sunPosition, sunQiblaHint, sunriseBearing, sunriseTime } from '../sun';

// Тестовете вървят с часова зона Europe/Sofia (jest.global-setup.js).
const SOFIA = { lat: 42.6977, lon: 23.3217 };
const QIBLA_SOFIA = qiblaBearing(SOFIA.lat, SOFIA.lon); // 141,9°
const hm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

describe('положение на слънцето', () => {
  it('София, 1 окт. 2026, 13:39 – на юг-югозапад, високо', () => {
    const p = sunPosition(new Date('2026-10-01T13:39:00+03:00'), SOFIA.lat, SOFIA.lon);
    expect(p.azimuth).toBeGreaterThan(185);
    expect(p.azimuth).toBeLessThan(191);
    expect(p.altitude).toBeGreaterThan(42);
    expect(p.altitude).toBeLessThan(46);
  });

  it('пладне в равноденствие на екватора – почти в зенита', () => {
    // 20 март 2026, слънчево пладне на Гринуич ≈ 12:07 UTC
    const p = sunPosition(new Date('2026-03-20T12:07:00Z'), 0, 0);
    expect(p.altitude).toBeGreaterThan(88);
  });

  it('изгрев в София по сезони: юни ~56°, равноденствие ~90°, декември ~122°', () => {
    const at = (iso: string) => sunPosition(new Date(iso), SOFIA.lat, SOFIA.lon);
    expect(at('2026-06-21T05:48:00+03:00').azimuth).toBeCloseTo(56, -1);
    expect(at('2026-12-21T07:56:00+02:00').azimuth).toBeCloseTo(122, -1);
  });

  it('нощем е под хоризонта', () => {
    expect(sunPosition(new Date('2026-10-01T23:00:00+03:00'), SOFIA.lat, SOFIA.lon).altitude).toBeLessThan(-30);
  });
});

describe('слънцето в посоката на Киблата', () => {
  it('София, 1 окт. 2026 – в 11:18, на ~37° височина', () => {
    const at = sunAtAzimuth(new Date(2026, 9, 1), SOFIA.lat, SOFIA.lon, QIBLA_SOFIA)!;
    expect(hm(at)).toBe('11:18');
    expect(sunPosition(at, SOFIA.lat, SOFIA.lon).altitude).toBeCloseTo(37, 0);
  });

  it('утре минута по-рано', () => {
    expect(hm(sunAtAzimuth(new Date(2026, 9, 2), SOFIA.lat, SOFIA.lon, QIBLA_SOFIA)!)).toBe('11:17');
  });

  it('посока, в която слънцето никога не застава (север) – null', () => {
    expect(sunAtAzimuth(new Date(2026, 9, 1), SOFIA.lat, SOFIA.lon, 0)).toBeNull();
  });

  it('твърде ниско над хоризонта – null', () => {
    // Ню Йорк: Киблата е на ~58°; през октомври слънцето е там само под хоризонта
    const ny = { lat: 40.7128, lon: -74.006 };
    expect(sunAtAzimuth(new Date(2026, 9, 1), ny.lat, ny.lon, qiblaBearing(ny.lat, ny.lon))).toBeNull();
  });

  it('полярна нощ – null', () => {
    expect(sunAtAzimuth(new Date(2026, 11, 21), 78.22, 15.65, qiblaBearing(78.22, 15.65))).toBeNull();
  });
});

describe('текстът в картата', () => {
  const hint = (iso: string) => sunQiblaHint(new Date(iso), SOFIA.lat, SOFIA.lon, QIBLA_SOFIA)!;

  it('сутрин – „днес в 11:18“', () => {
    const h = hint('2026-10-01T09:30:00+03:00');
    expect(h.kind).toBe('today');
    expect(hm(h.time)).toBe('11:18');
  });

  it('в 11:20 – „сега“', () => {
    expect(hint('2026-10-01T11:20:00+03:00').kind).toBe('now');
  });

  it('вечер – „утре в 11:17“', () => {
    const h = hint('2026-10-01T20:30:00+03:00');
    expect(h.kind).toBe('tomorrow');
    expect(hm(h.time)).toBe('11:17');
  });
});

describe('изгревът спрямо Киблата', () => {
  it('истинският изгрев в София на 1 окт. 2026 е в 07:24 (Мюфтийството дава 07:16 – с предпазен интервал)', () => {
    expect(hm(sunriseTime(new Date(2026, 9, 1), SOFIA.lat, SOFIA.lon)!)).toBe('07:24');
  });

  it('София, 1 окт.: изгрев на ~94°, Киблата е ~48° вдясно', () => {
    const b = sunriseBearing(new Date(2026, 9, 1), SOFIA.lat, SOFIA.lon, QIBLA_SOFIA)!;
    expect(Math.round(b.azimuth)).toBe(94);
    expect(b.side).toBe('right');
    expect(b.degrees).toBe(48);
  });

  it('декември: изгрев на ~122° – Киблата е ~20° вдясно; юни: ~56° – ~86° вдясно', () => {
    expect(sunriseBearing(new Date(2026, 11, 21), SOFIA.lat, SOFIA.lon, QIBLA_SOFIA)!.degrees).toBeCloseTo(20, -1);
    expect(sunriseBearing(new Date(2026, 5, 21), SOFIA.lat, SOFIA.lon, QIBLA_SOFIA)!.degrees).toBeCloseTo(86, -1);
  });

  it('полярна нощ – няма изгрев', () => {
    expect(sunriseBearing(new Date(2026, 11, 21), 78.22, 15.65, qiblaBearing(78.22, 15.65))).toBeNull();
  });
});
