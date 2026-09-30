import { computeCalcDay } from '../calc';
import type { AppLocation } from '../location';
import { computeMuftiDay } from '../mufti';

const sofiaCalc: AppLocation = {
  id: 'sofia-calc',
  names: { bg: 'София', en: 'Sofia' },
  latitude: 42.6977,
  longitude: 23.3217,
  source: 'calc',
};

describe('изчисление с adhan (извън България)', () => {
  it('часовете вървят в правилния ред', () => {
    const istanbul: AppLocation = { ...sofiaCalc, id: 'ist', latitude: 41.0082, longitude: 28.9784 };
    const t = computeCalcDay(new Date(2026, 5, 21, 12), istanbul, 'Turkey', 'shafi').map((p) => p.time.getTime());
    for (let k = 1; k < t.length; k++) expect(t[k]).toBeGreaterThan(t[k - 1]);
  });

  it('Ханафи дава по-късен Аср от Шафии', () => {
    const date = new Date(2026, 5, 21, 12);
    const shafi = computeCalcDay(date, sofiaCalc, 'Turkey', 'shafi')[3].time.getTime();
    const hanafi = computeCalcDay(date, sofiaCalc, 'Turkey', 'hanafi')[3].time.getTime();
    expect(hanafi - shafi).toBeGreaterThan(30 * 60_000);
  });

  // Документира защо в България ползваме таблицата: изчислението се разминава с до ~4 мин.
  it('за София се разминава с Мюфтийството с най-много 4 минути през 2026', () => {
    let worst = 0;
    for (let i = 0; i < 365; i++) {
      const date = new Date(2026, 0, 1 + i, 12);
      const calc = computeCalcDay(date, sofiaCalc, 'Turkey', 'shafi');
      const mufti = computeMuftiDay(date, 0);
      calc.forEach((p, k) => {
        worst = Math.max(worst, Math.abs(p.time.getTime() - mufti[k].time.getTime()) / 60_000);
      });
    }
    expect(worst).toBeLessThanOrEqual(4.5);
  });
});
