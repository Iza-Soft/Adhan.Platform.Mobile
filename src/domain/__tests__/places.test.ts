import { formatHM } from '../format';
import { insideBorder } from '../geo';
import data from '@/data/places.json';

import { allCities, isInBulgaria, nearestPlace, placeToLocation, searchPlaces } from '../places';
import { locationFromCoords } from '../resolve';
import { computeDay } from '../times';
import { transliterate } from '../translit';

const opts = { method: 'Turkey' as const, madhab: 'shafi' as const };
const times = (lat: number, lon: number, date = new Date(2026, 8, 29, 12)) =>
  computeDay(date, { ...opts, location: locationFromCoords(lat, lon) }).map((p) => formatHM(p.time));

describe('в България ли съм', () => {
  it.each([
    ['София', 42.6977, 23.3219],
    ['Чепинци (Смолянско)', 41.4348, 24.8682],
    ['Кулата', 41.39, 23.36],
    ['Капитан Андреево', 41.72, 26.32],
    ['Силистра (на Дунава)', 44.1183, 27.26],
    ['Балчик (на брега)', 43.4049, 28.1681],
  ])('%s – да', (_, lat, lon) => {
    expect(isInBulgaria(lat, lon)).toBe(true);
  });

  it.each([
    ['Одрин', 41.6771, 26.5557],
    ['Промахон (на 2 км от Кулата)', 41.3703, 23.3706],
    ['Гюргево (срещу Русе)', 43.9037, 25.9699],
    ['Калафат (срещу Видин)', 43.99, 22.93],
    ['Истанбул', 41.0082, 28.9784],
    ['Единбург', 55.9533, -3.1883],
  ])('%s – не', (_, lat, lon) => {
    expect(isInBulgaria(lat, lon)).toBe(false);
  });

  it('границата сама изрязва някои крайбрежни места – затова има и проверка за разстояние', () => {
    expect(insideBorder(43.4049, 28.1681)).toBe(false); // Балчик извън опростената граница
    expect(isInBulgaria(43.4049, 28.1681)).toBe(true);
  });
});

describe('населено място по GPS', () => {
  it('Чепинци, Смолянско – името на селото, а не на общината', () => {
    const loc = locationFromCoords(41.4352, 24.8690);
    expect(loc.names.bg).toBe('Чепинци');
    expect(loc.names.en).toBe('Chepintsi');
    expect(loc.detail?.bg).toBe('общ. Рудозем, обл. Смолян');
    expect(loc.source).toBe('mufti');
  });

  it('Чепинци е София −6 мин. (най-близкият град от календара е Мадан)', () => {
    expect(locationFromCoords(41.4348, 24.8682).muftiShift).toBe(-6);
    expect(times(41.4348, 24.8682)).toEqual(['05:39', '07:08', '13:16', '16:35', '19:15', '20:37']);
  });

  it('двете села Чепинци се различават по община и област', () => {
    const both = searchPlaces('Чепинци').filter((p) => p.name === 'Чепинци');
    expect(both).toHaveLength(2);
    const details = both.map((p) => placeToLocation(p).detail?.bg);
    expect(details).toContain('общ. Рудозем, обл. Смолян');
    expect(details).toContain('общ. Столична, обл. София-град');
  });

  it.each([
    ['при „м. Детски град“ (грешката от телефона)', 42.6135, 23.3966],
    ['Младост 4', 42.628, 23.38],
    ['Горубляне', 42.63, 23.41],
    ['Дружба 2', 42.655, 23.41],
    ['Люлин 10', 42.72, 23.245],
    ['Обеля', 42.745, 23.25],
    ['Бояна', 42.645, 23.265],
    ['Надежда', 42.735, 23.3],
  ])('в София, %s → „София“, а не местност или село', (_, lat, lon) => {
    const loc = locationFromCoords(lat, lon);
    expect(loc.names.bg).toBe('София');
    expect(loc.detail?.bg).toBe('обл. София-град');
  });

  it.each([
    ['Кубратово (в радиуса на София)', 42.7755, 23.3625, 'Кубратово', 'общ. Столична, обл. София-град'],
    ['Герман', 42.6135, 23.4150, 'Герман', 'общ. Столична, обл. София-град'],
    ['Бусманци', 42.6770, 23.4360, 'Бусманци', 'общ. Столична, обл. София-град'],
    ['Каменар до Варна', 43.2500, 27.9110, 'Каменар', 'общ. Варна, обл. Варна'],
  ])('село до голям град си остава село: %s', (_, lat, lon, name, detail) => {
    const loc = locationFromCoords(lat, lon);
    expect(loc.names.bg).toBe(name);
    expect(loc.detail?.bg).toBe(detail);
  });

  it('в списъка няма местности, вилни зони и квартали', () => {
    expect(searchPlaces('Детски град')).toEqual([]);
    expect(searchPlaces('м. ').length).toBe(0);
    expect(searchPlaces('вилна зона')).toEqual([]);
  });

  it('град от календара дава точно неговата разлика (Варна −18)', () => {
    const { place } = nearestPlace(43.2074, 27.9167);
    expect(place.name).toBe('Варна');
    expect(placeToLocation(place).muftiShift).toBe(-18);
  });
});

describe('извън България', () => {
  it('Истанбул – изчисление за координатите', () => {
    const loc = locationFromCoords(41.0082, 28.9784, { names: { bg: 'Истанбул', en: 'Istanbul' } });
    expect(loc.source).toBe('calc');
    expect(loc.names.bg).toBe('Истанбул');
  });

  it('без име (няма интернет) – показва координатите', () => {
    expect(locationFromCoords(55.9533, -3.1883).names.en).toBe('55.95°N 3.19°W');
  });

  it('Единбург през лятото: Иша и Фаджр не се сливат с „една седма от нощта“', () => {
    const t = times(55.9533, -3.1883, new Date(2026, 5, 21, 12));
    // в тестовете часовата зона е Europe/Sofia (+2 ч спрямо Лондон лятото)
    const [fajr, , , , maghrib, isha] = t;
    expect(isha > maghrib).toBe(true);
    expect(fajr).not.toBe(isha);
  });
});

describe('търсене', () => {
  it('на кирилица и на латиница', () => {
    expect(searchPlaces('чепин').map((p) => p.name)).toContain('Чепинци');
    expect(searchPlaces('chepin').map((p) => p.name)).toContain('Чепинци');
  });

  it('точното съвпадение и градовете са първи', () => {
    expect(searchPlaces('Варна')[0].name).toBe('Варна');
    expect(searchPlaces('Смолян')[0].kind).toBe(0);
  });

  it('списъкът е подреден по азбука още в данните (без бавното localeCompare на телефона)', () => {
    const c = new Intl.Collator('bg');
    const names = (data.places as [string][]).map((r) => r[0]);
    for (let i = 1; i < names.length; i++) expect(c.compare(names[i - 1], names[i])).toBeLessThanOrEqual(0);
  });

  it('градовете без търсене: 256, по азбука, от Айтос', () => {
    const list = allCities();
    expect(list).toHaveLength(256);
    expect(list[0].name).toBe('Айтос');
    expect(list.every((p) => p.kind === 0)).toBe(true);
  });

  it('„ch“ (875 съвпадения) – първо градовете, по азбука', () => {
    const r = searchPlaces('ch');
    expect(r).toHaveLength(40);
    const cityNames = r.filter((p) => p.kind === 0).map((p) => p.name);
    expect(cityNames).toEqual([...cityNames].sort(new Intl.Collator('bg').compare));
  });

  it('под 2 букви не търси', () => {
    expect(searchPlaces('с')).toEqual([]);
  });
});

describe('транслитерация', () => {
  it.each([
    ['Кърджали', 'Kardzhali'],
    ['Свищов', 'Svishtov'],
    ['Провадия', 'Provadia'],
    ['Велико Търново', 'Veliko Tarnovo'],
    ['София', 'Sofia'],
    ['Горна Оряховица', 'Gorna Oryahovitsa'],
  ])('%s → %s', (bg, en) => {
    expect(transliterate(bg)).toBe(en);
  });
});
