import { bg } from '@/i18n/strings';
import { PHASE_GRADIENTS } from '@/theme/gradients';

import { locationFromCoords } from '../resolve';
import { planWidget, widgetEntryAt, WIDGET_DAYS, type WidgetInput } from '../widget';

const sofia = locationFromCoords(42.6977, 23.3219);
const options = { location: sofia, method: 'Turkey' as const, madhab: 'shafi' as const };
const texts = { prayers: bg.prayers, ...bg.hero, ...bg.widget };

const input = (now: Date): WidgetInput => ({ now, options, placeName: 'София', texts, gradients: PHASE_GRADIENTS });
const at = (h: number, m: number, s = 0, day = 5) => new Date(2026, 9, day, h, m, s);

describe('widget – кадърът в даден момент', () => {
  it('15:20 – Зухр, следва Аср в 16:33 (като в mockup-а)', () => {
    const e = widgetEntryAt(at(15, 20, 15), input(at(15, 20, 15)));
    expect(e.phase).toBe('dhuhr');
    expect(e.colors).toEqual(PHASE_GRADIENTS.dhuhr);
    expect(e.place).toBe('СОФИЯ');
    expect([e.next, e.nextName, e.nextArabic, e.nextTime]).toEqual(['asr', 'Аср', 'العصر', '16:33']);
    expect(e.atText).toBe('в 16:33');
    expect(e.shortAt).toBe('16:33');
    expect(e.untilText).toBe('остават до Аср');
    expect(e.nextAt - at(15, 20, 15).getTime()).toBe(((1 * 60 + 12) * 60 + 45) * 1000);
    expect(e.prevAt).toBe(at(13, 20).getTime());
    expect(e.rows.map((r) => `${r.name} ${r.time} ${r.state}`)).toEqual([
      'Фаджр 05:53 past',
      'Изгрев 07:20 past',
      'Зухр 13:20 now',
      'Аср 16:33 next',
      'Магриб 19:11 later',
      'Иша 20:32 later',
    ]);
  });

  it('след Иша – следващият е Фаджр утре', () => {
    const e = widgetEntryAt(at(23, 15), input(at(23, 15)));
    expect(e.phase).toBe('isha');
    expect(e.next).toBe('fajr');
    expect(e.atText).toMatch(/^утре в 05:5\d$/);
    expect(e.shortAt).toMatch(/^утре 05:5\d$/);
    expect(e.rows.filter((r) => r.state === 'next')).toHaveLength(0);
    expect(e.rows[5].state).toBe('now');
  });

  it('английски текстове', () => {
    const en = { prayers: { fajr: 'Fajr', sunrise: 'Sunrise', dhuhr: 'Dhuhr', asr: 'Asr', maghrib: 'Maghrib', isha: 'Isha' } };
    const e = widgetEntryAt(at(21, 10), {
      ...input(at(21, 10)),
      placeName: 'Sofia',
      texts: { ...texts, prayers: en.prayers, next: 'Next', at: (t) => `at ${t}`, tomorrowAt: (t) => `tomorrow at ${t}`, tomorrowShort: (t) => `tomorrow ${t}`, until: (n) => `until ${n}`, left: 'left' },
    });
    expect(e.place).toBe('SOFIA');
    expect(e.nextName).toBe('Fajr');
    expect(e.atText).toMatch(/^tomorrow at 05:5\d$/);
  });
});

describe('widget – кадрите за следващите дни', () => {
  const plan = planWidget(input(at(15, 20, 15)));

  it('първият кадър започва от началото на текущата молитва', () => {
    expect(plan[0].from).toBe(at(13, 20).getTime());
    expect(plan[0].next).toBe('asr');
  });

  it('нов кадър в часа на всяка молитва и в полунощ, по ред', () => {
    expect(plan[1].from).toBe(at(16, 33).getTime());
    expect(plan[1].phase).toBe('asr');
    expect(plan.some((e) => e.from === at(0, 0, 0, 6).getTime())).toBe(true);
    for (let i = 1; i < plan.length; i++) expect(plan[i].from).toBeGreaterThan(plan[i - 1].from);
    // кадърът важи, докато дойде следващата молитва
    for (const e of plan) expect(e.nextAt).toBeGreaterThan(e.from);
  });

  it('стига до 7 дни напред: 6 молитви + полунощ на ден', () => {
    const last = plan[plan.length - 1];
    expect(last.from).toBeLessThanOrEqual(at(0, 0, 0, 5 + WIDGET_DAYS).getTime());
    expect(plan.length).toBeGreaterThanOrEqual(WIDGET_DAYS * 7 - 2);
    expect(plan.length).toBeLessThanOrEqual(WIDGET_DAYS * 7 + 2);
  });

  it('в полунощ денят в списъка се сменя', () => {
    const midnight = plan.find((e) => e.from === at(0, 0, 0, 6).getTime())!;
    expect(midnight.phase).toBe('isha');
    expect(midnight.next).toBe('fajr');
    expect(midnight.rows.find((r) => r.id === 'fajr')!.state).toBe('next');
    expect(midnight.rows.filter((r) => r.state === 'past')).toHaveLength(0);
  });

  it('един и същ резултат през целия интервал – няма излишни обновявания', () => {
    const later = planWidget(input(at(16, 0)));
    expect(JSON.stringify(later)).toBe(JSON.stringify(plan));
    const afterAsr = planWidget(input(at(16, 40)));
    expect(afterAsr[0].from).toBe(at(16, 33).getTime());
  });
});
