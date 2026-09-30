import { CALC_METHODS, computeCalcDay, isPolar, isValidDay, POLAR_LATITUDE } from '../calc';
import type { AppLocation } from '../location';

const at = (lat: number, lon: number): AppLocation => ({
  id: `${lat},${lon}`,
  names: { bg: '', en: '' },
  latitude: lat,
  longitude: lon,
  source: 'calc',
});
const day = (m: number, d: number) => new Date(2026, m, d);

describe('часове за целия свят', () => {
  it('всяка ширина от Южния до Северния полюс, всеки месец – всички часове ги има и са по ред', () => {
    const bad: string[] = [];
    for (let lat = -90; lat <= 90; lat += 5) {
      for (const lon of [-150, -70, 0, 25, 90, 150]) {
        for (let m = 0; m < 12; m++) {
          for (const d of [1, 21]) {
            const t = computeCalcDay(day(m, d), at(lat, lon), 'MuslimWorldLeague', 'shafi');
            if (!isValidDay(t)) bad.push(`${lat},${lon} ${m + 1}/${d}`);
          }
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it.each(CALC_METHODS)('метод %s, Ханафи – също без грешки по целия свят', (method) => {
    const bad: string[] = [];
    for (let lat = -90; lat <= 90; lat += 10) {
      for (const lon of [-70, 25, 150]) {
        for (let m = 0; m < 12; m += 2) {
          const t = computeCalcDay(day(m, 21), at(lat, lon), method, 'hanafi');
          if (!isValidDay(t)) bad.push(`${lat},${lon} ${m + 1}/21`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it.each([
    ['Тромсьо, полярна нощ', 69.65, 18.96, day(11, 21)],
    ['Норилск, полярна нощ', 69.35, 88.2, day(11, 21)],
    ['Свалбард, полярна нощ', 78.22, 15.65, day(11, 21)],
    ['Свалбард, полярен ден', 78.22, 15.65, day(5, 21)],
    ['Тромсьо, полярен ден', 69.65, 18.96, day(5, 21)],
    ['Северен полюс', 89.99, 0, day(5, 21)],
    ['Южен полюс', -89.99, 0, day(5, 21)],
  ])('%s – няма изгрев/залез → часовете са за 65° ширина и са по ред', (_, lat, lon, date) => {
    expect(isPolar(lat)).toBe(true);
    const t = computeCalcDay(date, at(lat, lon), 'MuslimWorldLeague', 'shafi');
    expect(isValidDay(t)).toBe(true);
    const at65 = computeCalcDay(date, at(Math.sign(lat) * POLAR_LATITUDE, lon), 'MuslimWorldLeague', 'shafi');
    expect(t.map((p) => p.time.getTime())).toEqual(at65.map((p) => p.time.getTime()));
  });

  it('полярен район в нормален ден (Тромсьо, 30 септември) – истинската ширина, не 65°', () => {
    const t = computeCalcDay(day(8, 30), at(69.65, 18.96), 'Turkey', 'shafi');
    const at65 = computeCalcDay(day(8, 30), at(65, 18.96), 'Turkey', 'shafi');
    expect(isValidDay(t)).toBe(true);
    expect(t[4].time.getTime()).not.toBe(at65[4].time.getTime()); // Магриб
  });

  it('до 65° се смята за истинската ширина (Анкъридж, Икалуит, Ушуая)', () => {
    expect(isPolar(61.22)).toBe(false);
    expect(isPolar(63.75)).toBe(false);
    expect(isPolar(-54.8)).toBe(false);
    for (const [lat, lon] of [
      [61.22, -149.9],
      [63.75, -68.52],
      [-54.8, -68.3],
    ]) {
      expect(isValidDay(computeCalcDay(day(5, 21), at(lat, lon), 'MuslimWorldLeague', 'shafi'))).toBe(true);
      expect(isValidDay(computeCalcDay(day(11, 21), at(lat, lon), 'MuslimWorldLeague', 'shafi'))).toBe(true);
    }
  });

  it('месец в полярен район се смята бързо', () => {
    for (const m of [5, 11]) {
      const t0 = Date.now();
      for (let d = 1; d <= 30; d++) computeCalcDay(day(m, d), at(78.22, 15.65), 'Turkey', 'shafi');
      console.log(`Свалбард, месец ${m + 1}: ${Date.now() - t0} ms`);
      expect(Date.now() - t0).toBeLessThan(300);
    }
  });
});
