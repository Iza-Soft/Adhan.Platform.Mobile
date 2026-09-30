import { bg, en } from '@/i18n/strings';

import { formatCountdown, formatGregorianShort, formatHM } from '../format';
import { formatHijri, tabularHijri, toHijri } from '../hijri';

describe('форматиране', () => {
  it('час и обратно броене', () => {
    expect(formatHM(new Date(2026, 8, 29, 7, 5))).toBe('07:05');
    expect(formatCountdown(((1 * 60 + 49) * 60 + 12) * 1000)).toBe('01:49:12');
    expect(formatCountdown(500)).toBe('00:00:01'); // закръгля нагоре
    expect(formatCountdown(-1000)).toBe('00:00:00');
  });

  it('дата на двата езика', () => {
    const d = new Date(2026, 8, 29, 12);
    expect(formatGregorianShort(d, bg.date)).toBe('Вт, 29 септ.');
    expect(formatGregorianShort(d, en.date)).toBe('Tue, 29 Sep');
    expect(formatGregorianShort(new Date(2026, 2, 20, 12), bg.date)).toBe('Пт, 20 март');
  });
});

describe('дата по Хиджра', () => {
  it('Рамазан байрам 2026 е 1 Шеввал 1447', () => {
    const h = toHijri(new Date(2026, 2, 20, 12));
    expect([h.day, h.month, h.year]).toEqual([1, 10, 1447]);
  });

  it('табличният алгоритъм е в рамките на ±2 дни от Umm al-Qura', () => {
    for (let i = 0; i < 400; i += 7) {
      const d = new Date(2026, 0, 1 + i, 12);
      const a = toHijri(d);
      const b = tabularHijri(d);
      const sameMonth = a.year === b.year && a.month === b.month;
      if (sameMonth) expect(Math.abs(a.day - b.day)).toBeLessThanOrEqual(2);
    }
  });

  it('корекцията мести датата с ден', () => {
    const d = new Date(2026, 8, 29, 12);
    expect(toHijri(d, 1).day).toBe((toHijri(d).day % 30) + 1);
    expect(formatHijri(d, en.hijriMonths)).toMatch(/^\d{1,2} [A-Za-z' -]+ 1448$/);
  });
});
