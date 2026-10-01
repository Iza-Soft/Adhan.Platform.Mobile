import { computeCalcDay, methodForCountry } from '../calc';
import { batteryBrand } from '../device';
import { formatHM } from '../format';
import { countryOf, locationFromCoords } from '../resolve';
import { countryAt, countryName, nearestCity, offlinePlaceName } from '../worldCities';

describe('офлайн градовете по света', () => {
  it.each([
    ['центъра на Истанбул (не квартала Eminönü)', 41.0054, 28.9768, 'Istanbul', 'TR'],
    ['Кадъкьой – пак Истанбул', 40.99, 29.03, 'Istanbul', 'TR'],
    ['Берлин Мите (не квартала Mitte)', 52.52, 13.405, 'Berlin', 'DE'],
    ['Париж', 48.8566, 2.3522, 'Paris', 'FR'],
    ['Одрин', 41.6771, 26.5557, 'Edirne', 'TR'],
    ['Скопие', 41.9981, 21.4254, 'Skopje', 'MK'],
    ['Мека', 21.4225, 39.8262, 'Mecca', 'SA'],
  ])('%s', (_, lat, lon, name, cc) => {
    const c = nearestCity(lat, lon)!;
    expect(c.name).toBe(name);
    expect(c.country).toBe(cc);
  });

  it('в открития океан – няма град, няма държава', () => {
    expect(nearestCity(30, -40)).toBeNull();
    expect(countryAt(30, -40)).toBeNull();
  });

  it('България не е в списъка (там е подробният списък на селищата)', () => {
    expect(nearestCity(42.6977, 23.3217, 5)).toBeNull();
  });

  it('името без интернет: градът и държавата на езика на приложението', () => {
    expect(offlinePlaceName(41.0054, 28.9768)).toEqual({
      names: { bg: 'Istanbul', en: 'Istanbul' },
      detail: { bg: 'Турция', en: 'Türkiye' },
    });
    expect(countryName('DE', 'bg')).toBe('Германия');
    expect(countryName('XX', 'bg')).toBe('XX');
  });
});

describe('метод „Автоматично“ според държавата', () => {
  it.each([
    ['TR', 'Turkey'],
    ['DE', 'Turkey'],
    ['MK', 'Turkey'],
    ['FR', 'France'],
    ['GB', 'MoonsightingCommittee'],
    ['US', 'NorthAmerica'],
    ['CA', 'NorthAmerica'],
    ['SA', 'UmmAlQura'],
    ['EG', 'Egyptian'],
    ['PK', 'Karachi'],
    ['RU', 'Russia'],
    ['MY', 'Malaysia'],
    ['ID', 'Indonesia'],
    ['AE', 'Dubai'],
    ['KW', 'Kuwait'],
    ['QA', 'Qatar'],
    ['SG', 'Singapore'],
    ['IR', 'Tehran'],
    ['JP', 'MuslimWorldLeague'],
    [null, 'MuslimWorldLeague'],
  ])('%s → %s', (cc, method) => {
    expect(methodForCountry(cc)).toBe(method);
  });

  it('мястото от GPS помни държавата; старите записи я намират по координатите', () => {
    const paris = locationFromCoords(48.8566, 2.3522, null);
    expect(paris.country).toBe('FR');
    expect(countryOf({ ...paris, country: undefined, id: 'old-paris' })).toBe('FR');
    expect(countryOf(locationFromCoords(42.6977, 23.3217))).toBe('BG');
  });
});

describe('новите методи', () => {
  const day = new Date(2026, 9, 1, 12);
  const at = (lat: number, lon: number, method: Parameters<typeof computeCalcDay>[2]) =>
    Object.fromEntries(
      computeCalcDay(day, { id: 'x', names: { bg: '', en: '' }, latitude: lat, longitude: lon, source: 'calc' }, method, 'shafi').map(
        (p) => [p.id, p.time],
      ),
    );

  it('Франция (UOIF 12°): Фаджр в Париж е по-късно от Muslim World League (18°)', () => {
    const uoif = at(48.8566, 2.3522, 'France');
    const mwl = at(48.8566, 2.3522, 'MuslimWorldLeague');
    expect(uoif.fajr.getTime() - mwl.fajr.getTime()).toBeGreaterThan(20 * 60_000);
    expect(uoif.isha.getTime()).toBeLessThan(mwl.isha.getTime());
  });

  it('Малайзия и Индонезия (20°/18°): Фаджр по-рано от MWL (18°)', () => {
    const jakim = at(3.139, 101.6869, 'Malaysia');
    const mwl = at(3.139, 101.6869, 'MuslimWorldLeague');
    expect(jakim.fajr.getTime()).toBeLessThan(mwl.fajr.getTime());
  });

  it('Русия (16°/15°) – подредени часове в Москва', () => {
    const t = at(55.7558, 37.6173, 'Russia');
    const order = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'].map((k) => t[k].getTime());
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(formatHM(t.dhuhr)).toMatch(/^\d\d:\d\d$/);
  });
});

describe('марката на телефона', () => {
  it.each([
    ['samsung', 'samsung', 'samsung'],
    ['Xiaomi', 'Redmi', 'xiaomi'],
    ['Xiaomi', 'POCO', 'xiaomi'],
    ['HUAWEI', 'HUAWEI', 'huawei'],
    ['HONOR', 'HONOR', 'huawei'],
    ['OnePlus', 'OnePlus', 'oppo'],
    ['realme', 'realme', 'oppo'],
    ['Google', 'google', 'other'],
    [undefined, undefined, 'other'],
  ])('%s / %s → %s', (m, b, expected) => {
    expect(batteryBrand(m, b)).toBe(expected);
  });
});
