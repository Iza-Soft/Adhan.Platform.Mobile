import { bg } from '@/i18n/strings';

import { toHijri } from '../hijri';
import { hijriFromTable } from '../hijriTable';
import { holidaysInYear, nextHoliday, resolveHolidaySource, type HolidayId } from '../holidays';
import { planHolidayReminders } from '../notifications';
import type { AppLocation } from '../location';
import type { TimesOptions } from '../times';

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dates = (year: number, source: 'mufti' | 'diyanet' | 'ummalqura' = 'mufti') => {
  const out: Partial<Record<HolidayId, string>> = {};
  for (const h of holidaysInYear(source, year)) out[h.id] = h.end.getTime() === h.date.getTime() ? ymd(h.date) : `${ymd(h.date)}/${ymd(h.end)}`;
  return out;
};

describe('празници – точно като обявените от Диянет / Мюфтийството', () => {
  it('2026 (утвърдени и в България: Рамазан Байрам 20 март, Курбан Байрам 27 май)', () => {
    expect(dates(2026)).toEqual({
      miraj: '2026-01-15',
      berat: '2026-02-02',
      ramadan: '2026-02-19',
      qadr: '2026-03-16',
      fitrEve: '2026-03-19',
      fitr: '2026-03-20/2026-03-22',
      arafah: '2026-05-26',
      adha: '2026-05-27/2026-05-30',
      newYear: '2026-06-16',
      ashura: '2026-06-25',
      mawlid: '2026-08-24',
      threeMonths: '2026-12-10',
      regaib: '2026-12-10',
    });
  });

  it('2027 – Байрамите', () => {
    const d = dates(2027);
    expect([d.fitrEve, d.fitr, d.arafah, d.adha]).toEqual([
      '2027-03-08',
      '2027-03-09/2027-03-11',
      '2027-05-15',
      '2027-05-16/2027-05-19',
    ]);
  });

  it('2021–2023 – свещените нощи', () => {
    const a = dates(2021);
    expect([a.regaib, a.miraj, a.berat, a.qadr, a.mawlid]).toEqual(['2021-02-18', '2021-03-10', '2021-03-27', '2021-05-08', '2021-10-17']);
    const b = dates(2022);
    expect([b.regaib, b.miraj, b.berat, b.ramadan, b.qadr, b.fitr?.slice(0, 10), b.adha?.slice(0, 10)]).toEqual([
      '2022-02-03',
      '2022-02-27',
      '2022-03-17',
      '2022-04-02',
      '2022-04-27',
      '2022-05-02',
      '2022-07-09',
    ]);
    const c = dates(2023);
    expect([c.threeMonths, c.regaib, c.miraj, c.berat, c.ramadan, c.qadr, c.mawlid]).toEqual([
      '2023-01-23',
      '2023-01-26',
      '2023-02-17',
      '2023-03-06',
      '2023-03-23',
      '2023-04-17',
      '2023-09-26',
    ]);
    expect(dates(2025).regaib).toBe('2025-12-25');
  });

  it('Умм ал-Кура: Рамазан и Байрамите – очаквани, Новата година – не', () => {
    const list = holidaysInYear('ummalqura', 2027);
    const get = (id: HolidayId) => list.find((h) => h.id === id)!;
    expect(ymd(get('ramadan').date)).toBe('2027-02-08');
    expect(get('ramadan').expected).toBe(true);
    expect(get('adha').expected).toBe(true);
    expect(get('newYear').expected).toBe(false);
    expect(holidaysInYear('mufti', 2027).some((h) => h.expected)).toBe(false);
  });

  it('„Автоматично“ – според държавата', () => {
    expect(resolveHolidaySource('auto', 'BG')).toBe('mufti');
    expect(resolveHolidaySource('auto', 'TR')).toBe('diyanet');
    expect(resolveHolidaySource('auto', 'DE')).toBe('diyanet');
    expect(resolveHolidaySource('auto', 'SA')).toBe('ummalqura');
    expect(resolveHolidaySource('auto', null)).toBe('diyanet');
    expect(resolveHolidaySource('ummalqura', 'BG')).toBe('ummalqura');
  });

  it('следващият празник и датата по Хиджра', () => {
    const now = new Date(2026, 9, 6, 10);
    expect(ymd(nextHoliday('mufti', now)!.date)).toBe('2026-12-10');
    expect(toHijri(now, 0, 'diyanet')).toEqual({ day: 25, month: 4, year: 1448 });
    expect(hijriFromTable(new Date(2026, 2, 20, 12), 'diyanet')).toEqual({ day: 1, month: 10, year: 1447 });
  });
});

describe('празници – напомнянията', () => {
  const location: AppLocation = {
    id: 'kardzhali',
    names: { bg: 'Кърджали', en: 'Kardzhali' },
    latitude: 41.64,
    longitude: 25.37,
    source: 'calc',
    country: 'BG',
  };
  const options = { location, method: 'Turkey', madhab: 'shafi', highLatRule: 'middleofthenight', offsets: { fajr: 0, sunrise: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 } } as unknown as TimesOptions;

  it('свещена нощ – същата вечер при Магриб; празник – вечерта преди', () => {
    const plan = planHolidayReminders({
      now: new Date(2026, 11, 1, 9),
      options,
      source: 'mufti',
      enabled: { regaib: true },
      texts: bg.holidays,
    });
    expect(plan).toHaveLength(1);
    expect(ymd(plan[0].at)).toBe('2026-12-10');
    expect(plan[0].at.getHours()).toBeGreaterThanOrEqual(16);
    expect(plan[0].title).toBe('Тази вечер: Нощ Регаиб');

    const adha = planHolidayReminders({
      now: new Date(2026, 4, 20, 9),
      options,
      source: 'mufti',
      enabled: { adha: true },
      texts: bg.holidays,
    });
    expect(ymd(adha[0].at)).toBe('2026-05-26');
    expect(adha[0].title).toBe('Утре: Курбан Байрам');
  });

  it('без включени напомняния – нищо', () => {
    expect(planHolidayReminders({ now: new Date(2026, 4, 20), options, source: 'mufti', enabled: {}, texts: bg.holidays })).toEqual([]);
  });
});
