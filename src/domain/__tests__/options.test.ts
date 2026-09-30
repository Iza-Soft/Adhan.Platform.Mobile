import { DEFAULT_LOCATION } from '@/config/defaults';

import { computeCalcDay } from '../calc';
import type { AppLocation } from '../location';
import { computeDay } from '../times';

const date = new Date(2026, 8, 29, 12);
const edinburgh: AppLocation = {
  id: 'edi',
  names: { bg: 'Единбург', en: 'Edinburgh' },
  latitude: 55.9533,
  longitude: -3.1883,
  source: 'calc',
};

describe('ръчни корекции', () => {
  it('+2 мин. на Магриб мести само Магриб', () => {
    const base = computeDay(date, { location: DEFAULT_LOCATION, method: 'Turkey', madhab: 'shafi' });
    const adj = computeDay(date, {
      location: DEFAULT_LOCATION,
      method: 'Turkey',
      madhab: 'shafi',
      offsets: { maghrib: 2 },
    });
    adj.forEach((p, k) => {
      const diff = (p.time.getTime() - base[k].time.getTime()) / 60_000;
      expect(diff).toBe(p.id === 'maghrib' ? 2 : 0);
    });
  });
});

describe('източник и настройки', () => {
  it('в България методът и Асрът не променят часовете (ползва се календарът)', () => {
    const a = computeDay(date, { location: DEFAULT_LOCATION, method: 'Turkey', madhab: 'shafi' });
    const b = computeDay(date, { location: DEFAULT_LOCATION, method: 'MuslimWorldLeague', madhab: 'hanafi' });
    expect(b.map((p) => p.time.getTime())).toEqual(a.map((p) => p.time.getTime()));
  });

  it('извън България методът променя Фаджр (Истанбул: Диянет 18°, Египет 19,5°)', () => {
    // На северни ширини правилото „1/7 от нощта“ често определя Фаджр вместо ъгъла,
    // затова методът се сравнява на нормална ширина.
    const istanbul: AppLocation = { ...edinburgh, id: 'ist', latitude: 41.0082, longitude: 28.9784 };
    const turkey = computeCalcDay(date, istanbul, 'Turkey', 'shafi')[0].time.getTime();
    const egypt = computeCalcDay(date, istanbul, 'Egyptian', 'shafi')[0].time.getTime();
    expect(egypt).toBeLessThan(turkey); // по-голям ъгъл → по-ранен Фаджр
  });

  it('правилото за северни ширини важи над 48°', () => {
    const summer = new Date(2026, 5, 21, 12);
    const seventh = computeCalcDay(summer, edinburgh, 'Turkey', 'shafi', 'seventhofthenight')[5].time.getTime();
    const middle = computeCalcDay(summer, edinburgh, 'Turkey', 'shafi', 'middleofthenight')[5].time.getTime();
    expect(seventh).not.toBe(middle);
  });

  it('над полярния кръг (Тромсьо, юни) пак има часове', () => {
    const tromso: AppLocation = { ...edinburgh, id: 'tos', latitude: 69.6492, longitude: 18.9553 };
    const t = computeCalcDay(new Date(2026, 5, 21, 12), tromso, 'MuslimWorldLeague', 'shafi');
    t.forEach((p) => expect(Number.isNaN(p.time.getTime())).toBe(false));
  });
});
