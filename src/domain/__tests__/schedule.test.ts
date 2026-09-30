import { DEFAULT_LOCATION } from '@/config/defaults';

import { getSchedule } from '../prayers';
import { computeThreeDays, type TimesOptions } from '../times';

const opts: TimesOptions = { location: DEFAULT_LOCATION, method: 'Turkey', madhab: 'shafi' };
const at = (y: number, m: number, d: number, h: number, min: number) => new Date(y, m - 1, d, h, min);
const schedule = (now: Date) => getSchedule(now, computeThreeDays(now, opts));

describe('текуща и следваща молитва (София, 29.09.2026)', () => {
  // Фаджр 05:45, Изгрев 07:14, Зухр 13:22, Аср 16:41, Магриб 19:21, Иша 20:43

  it('следобед: сега е Аср, следва Магриб', () => {
    const s = schedule(at(2026, 9, 29, 17, 0));
    expect(s.current.id).toBe('asr');
    expect(s.next.id).toBe('maghrib');
    expect(s.isNextTomorrow).toBe(false);
    expect(s.remainingMs).toBe((2 * 60 + 21) * 60_000);
  });

  it('преди Фаджр: сега е вчерашната Иша, следва днешният Фаджр', () => {
    const s = schedule(at(2026, 9, 29, 3, 0));
    expect(s.current.id).toBe('isha');
    expect(s.current.time.getDate()).toBe(28);
    expect(s.next.id).toBe('fajr');
    expect(s.isNextTomorrow).toBe(false);
    expect(s.rowState('isha')).toBe('now');
    expect(s.rowState('fajr')).toBe('upcoming');
  });

  it('след Иша: следва утрешният Фаджр', () => {
    const s = schedule(at(2026, 9, 29, 22, 30));
    expect(s.current.id).toBe('isha');
    expect(s.next.id).toBe('fajr');
    expect(s.next.time.getDate()).toBe(30);
    expect(s.isNextTomorrow).toBe(true);
  });

  it('точно в часа на молитвата тя вече е текуща', () => {
    const s = schedule(at(2026, 9, 29, 13, 22));
    expect(s.current.id).toBe('dhuhr');
    expect(s.rowState('sunrise')).toBe('past');
  });

  it('прогресът е между 0 и 1', () => {
    for (let h = 0; h < 24; h++) {
      const p = schedule(at(2026, 9, 29, h, 17)).progress;
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    }
  });
});

describe('смяна на часовото време', () => {
  it('нощта към лятно време (29.03.2026) не обърква следващата молитва', () => {
    const s = schedule(at(2026, 3, 29, 2, 30)); // 02:30 – преди прескачането 03:00 → 04:00
    expect(s.current.id).toBe('isha');
    expect(s.next.id).toBe('fajr');
    expect(s.next.time.getDate()).toBe(29);
  });

  it('нощта към зимно време (25.10.2026) не обърква следващата молитва', () => {
    const s = schedule(at(2026, 10, 25, 3, 30));
    expect(s.next.id).toBe('fajr');
    expect(s.next.time.getDate()).toBe(25);
    expect(s.remainingMs).toBeGreaterThan(0);
  });
});
