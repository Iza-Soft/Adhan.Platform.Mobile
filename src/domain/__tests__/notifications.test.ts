import { bg } from '@/i18n/strings';

import { NOTIFICATION_LIMIT, planNotifications, planSignature, type AlertMode, type PlanInput } from '../notifications';
import type { PrayerId } from '../prayers';
import { locationFromCoords } from '../resolve';
import { computeDay } from '../times';

const chepintsi = locationFromCoords(41.4352, 24.869);
const options = { location: chepintsi, method: 'Turkey' as const, madhab: 'shafi' as const };
const texts = { prayers: bg.prayers, ...bg.notifications };

const ALL: Record<PrayerId, AlertMode> = {
  fajr: 'adhan',
  sunrise: 'notify',
  dhuhr: 'notify',
  asr: 'adhan',
  maghrib: 'adhan',
  isha: 'notify',
};

const input = (over: Partial<PlanInput> = {}): PlanInput => ({
  now: new Date(2026, 8, 30, 12, 0), // 30.09.2026, 12:00 – преди Зухр (13:16)
  options,
  modes: ALL,
  reminderMinutes: 0,
  placeName: 'Чепинци',
  texts,
  ...over,
});

describe('план на известията', () => {
  it('часовете са точно тези от „Днес“, по ред, само бъдещите', () => {
    const plan = planNotifications(input());
    const today = computeDay(new Date(2026, 8, 30, 12), options);
    // днес остават Зухр, Аср, Магриб, Иша
    expect(plan.slice(0, 4).map((n) => n.prayer)).toEqual(['dhuhr', 'asr', 'maghrib', 'isha']);
    expect(plan[0].at.getTime()).toBe(today.find((p) => p.id === 'dhuhr')!.time.getTime());
    for (let i = 1; i < plan.length; i++) expect(plan[i].at.getTime()).toBeGreaterThan(plan[i - 1].at.getTime());
  });

  it('текстовете: „Магриб – 19:13“ + следващата молитва', () => {
    const maghrib = planNotifications(input()).find((n) => n.prayer === 'maghrib')!;
    expect(maghrib.title).toBe('Магриб – 19:13');
    expect(maghrib.body).toBe('Време е за намаза Магриб (المغرب) · Чепинци\nСледваща: Иша в 20:35');
    expect(maghrib.sound).toBe('adhan');
    expect(maghrib.id).toBe('ezan-20260930-maghrib-prayer');
  });

  it('изгревът е винаги само известие (без езан), с текст за края на Фаджр', () => {
    const plan = planNotifications(input({ modes: { ...ALL, sunrise: 'adhan' } }));
    const sunrise = plan.find((n) => n.prayer === 'sunrise')!;
    expect(sunrise.sound).toBe('chime');
    expect(sunrise.body).toBe('Изгрев – краят на времето за Фаджр · Чепинци\nСледваща: Зухр в 13:16');
  });

  it('след Иша следващата е Фаджр „(утре)“ – с часа от следващия ден', () => {
    const isha = planNotifications(input()).find((n) => n.id === 'ezan-20260930-isha-prayer')!;
    const fajr = computeDay(new Date(2026, 9, 1, 12), options)[0].time;
    const hm = `${String(fajr.getHours()).padStart(2, '0')}:${String(fajr.getMinutes()).padStart(2, '0')}`;
    expect(isha.body.split('\n')[1]).toBe(`Следваща: Фаджр в ${hm} (утре)`);
  });

  it('изключена камбанка – няма известие за тази молитва', () => {
    const plan = planNotifications(input({ modes: { ...ALL, isha: 'off' } }));
    expect(plan.some((n) => n.prayer === 'isha')).toBe(false);
  });

  it('всички изключени – празен план', () => {
    const off = Object.fromEntries(Object.keys(ALL).map((k) => [k, 'off'])) as Record<PrayerId, AlertMode>;
    expect(planNotifications(input({ modes: off }))).toEqual([]);
  });

  it('напомняне 15 мин. преди – с кратък звук, преди самото известие', () => {
    const plan = planNotifications(input({ reminderMinutes: 15 }));
    const i = plan.findIndex((n) => n.id === 'ezan-20260930-maghrib-reminder');
    expect(plan[i].title).toBe('Магриб след 15 мин. – 19:13');
    expect(plan[i].body).toBe('Време е за абдест и подготовка за намаза · Чепинци');
    expect(plan[i].sound).toBe('chime');
    expect(plan[i + 1].id).toBe('ezan-20260930-maghrib-prayer');
    expect(plan[i + 1].at.getTime() - plan[i].at.getTime()).toBe(15 * 60_000);
  });

  it('до 62 известия (iOS пази до 64); последното е „Отвори Езан“', () => {
    const plan = planNotifications(input({ reminderMinutes: 10 }));
    expect(plan).toHaveLength(NOTIFICATION_LIMIT);
    const last = plan[plan.length - 1];
    expect(last.kind).toBe('refresh');
    expect(last.at.getTime()).toBeGreaterThan(plan[plan.length - 2].at.getTime());
  });

  it('без напомняния 7 дни се събират без „Отвори Езан“', () => {
    const plan = planNotifications(input());
    expect(plan.length).toBeLessThanOrEqual(NOTIFICATION_LIMIT);
    expect(plan.some((n) => n.kind === 'refresh')).toBe(false);
    expect(plan.filter((n) => n.prayer === 'maghrib')).toHaveLength(7);
  });

  it('известие след по-малко от 5 сек. не се планира', () => {
    const today = computeDay(new Date(2026, 8, 30, 12), options);
    const dhuhr = today.find((p) => p.id === 'dhuhr')!.time;
    const plan = planNotifications(input({ now: new Date(dhuhr.getTime() - 2_000) }));
    expect(plan[0].prayer).not.toBe('dhuhr');
  });

  it('отпечатъкът се сменя при друга настройка и е еднакъв при еднакъв план', () => {
    const a = planSignature(planNotifications(input()), 'v');
    const b = planSignature(planNotifications(input()), 'v');
    const c = planSignature(planNotifications(input({ reminderMinutes: 5 })), 'v');
    const d = planSignature(planNotifications(input()), 'no-vibrate');
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).not.toBe(d);
  });

  it('полярна нощ (Тромсьо) – всички известия са валидни дати', () => {
    const tromso = locationFromCoords(69.65, 18.96, { names: { bg: 'Тромсьо', en: 'Tromsø' } });
    const plan = planNotifications(input({ now: new Date(2026, 11, 20, 8), options: { ...options, location: tromso } }));
    expect(plan.length).toBeGreaterThan(20);
    expect(plan.every((n) => !isNaN(n.at.getTime()))).toBe(true);
  });
});
