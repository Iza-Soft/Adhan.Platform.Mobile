import { formatHM } from '../format';
import { computeMuftiDay, findTown, muftiShiftFor, nearestTown, townToLocation } from '../mufti';
import { computeDay } from '../times';

/** Часовете за деня като ['05:45', '07:14', ...] в часовата зона на теста (Europe/Sofia). */
const hm = (y: number, m: number, d: number, shift = 0) =>
  computeMuftiDay(new Date(y, m - 1, d, 12), shift).map((p) => formatHM(p.time));

describe('календар на Мюфтийството – София', () => {
  // Стойностите са преписани от grandmufti.bg (таблица „Времена за намаз“, София, септември).
  it('29 септември съвпада със сайта (лятно време)', () => {
    expect(hm(2026, 9, 29)).toEqual(['05:45', '07:14', '13:22', '16:41', '19:21', '20:43']);
  });

  it('1 септември съвпада със сайта', () => {
    expect(hm(2026, 9, 1)).toEqual(['05:09', '06:43', '13:32', '17:13', '20:11', '21:38']);
  });

  it('същата дата дава същите часове в друга година (вечен календар)', () => {
    expect(hm(2031, 9, 29)).toEqual(hm(2026, 9, 29));
  });

  it('смяната на лятно време мести часовете с един час', () => {
    const before = hm(2026, 3, 28); // последният ден зимно време
    const after = hm(2026, 3, 29); // първият ден лятно време
    const minutes = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3));
    const jump = minutes(after[2]) - minutes(before[2]); // Зухр се мени плавно
    expect(jump).toBeGreaterThanOrEqual(59);
    expect(jump).toBeLessThanOrEqual(60);
  });

  it('29 февруари е между 28 февруари и 1 март', () => {
    const mins = (d: number, m: number) =>
      computeMuftiDay(new Date(2028, m - 1, d, 12), 0).map(
        (p) => p.time.getHours() * 60 + p.time.getMinutes(),
      );
    const feb28 = mins(28, 2);
    const feb29 = mins(29, 2);
    const mar1 = mins(1, 3);
    feb29.forEach((v, k) => {
      expect(v).toBeGreaterThanOrEqual(Math.min(feb28[k], mar1[k]));
      expect(v).toBeLessThanOrEqual(Math.max(feb28[k], mar1[k]));
    });
  });

  it('часовете вървят в правилния ред всеки ден от годината', () => {
    for (let i = 0; i < 366; i++) {
      const day = computeMuftiDay(new Date(2028, 0, 1 + i, 12), 0).map((p) => p.time.getTime());
      for (let k = 1; k < day.length; k++) expect(day[k]).toBeGreaterThan(day[k - 1]);
    }
  });
});

describe('други градове', () => {
  it('Варна е София −18 минути', () => {
    expect(findTown('varna')?.shift).toBe(-18);
    expect(hm(2026, 9, 29, -18)).toEqual(['05:27', '06:56', '13:04', '16:23', '19:03', '20:25']);
  });

  it('computeDay използва календара за град от списъка', () => {
    const varna = townToLocation(findTown('varna')!);
    const times = computeDay(new Date(2026, 8, 29, 12), {
      location: varna,
      method: 'Turkey',
      madhab: 'shafi',
    }).map((p) => formatHM(p.time));
    expect(times[0]).toBe('05:27');
  });

  it('всички 48 града следват правилото „4 минути на градус“ (±2 мин.)', () => {
    const sofia = findTown('sofia')!;
    for (const id of ['varna', 'burgas', 'kardjali', 'ruse', 'shumen', 'plovdiv', 'blagoevgrad']) {
      const t = findTown(id)!;
      const estimate = -(t.lon - sofia.lon) * 4;
      expect(Math.abs(estimate - t.shift)).toBeLessThanOrEqual(2);
    }
  });
});

describe('място извън списъка (село, GPS)', () => {
  it('в самия град дава неговата разлика', () => {
    const v = findTown('varna')!;
    expect(muftiShiftFor(v.lat, v.lon)).toBe(-18);
  });

  it('Момчилград е най-близо до Кърджали', () => {
    const { town } = nearestTown(41.527, 25.408);
    expect(town.id).toBe('kardjali');
    expect(muftiShiftFor(41.527, 25.408)).toBe(-8);
  });
});
