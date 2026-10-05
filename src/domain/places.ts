import data from '@/data/places.json';

import { fastKm, insideBorder, nearBulgaria } from './geo';
import type { AppLocation } from './location';
import { muftiShiftFor } from './mufti';
import { normalizeForSearch, transliterate } from './translit';
import { TR_PLACE_NAMES } from './trNames';

/**
 * Всички ~6 700 населени места в България (OpenStreetMap, © OpenStreetMap contributors, ODbL).
 * Във файла: [име, ширина, дължина, индекс на област, индекс на община, вид].
 * Местностите („м. …“), вилните зони и кварталите са махнати при подготовката
 * на файла – те не са населени места (оттам идваше „м. Детски град“ в София).
 */
export type PlaceKind = 0 | 1 | 2; // град, село, махала

export interface Place {
  index: number;
  name: string;
  lat: number;
  lon: number;
  oblast: string;
  obshtina: string;
  kind: PlaceKind;
}

type Row = [string, number, number, number, number, number];
const ROWS = data.places as Row[];

export const PLACES_SOURCE: string = data.source;
export const PLACES_COUNT = ROWS.length;

export function getPlace(index: number): Place {
  const [name, lat, lon, o, s, kind] = ROWS[index];
  return {
    index,
    name,
    lat,
    lon,
    oblast: data.oblasti[o],
    obshtina: data.obshtini[s],
    kind: kind as PlaceKind,
  };
}

/** Най-близката точка от списъка по права линия (за проверката „в България ли съм“). */
export function nearestPlace(lat: number, lon: number): { place: Place; km: number } {
  let best = 0;
  let bestKm = Infinity;
  const cosLat = Math.cos((lat * Math.PI) / 180);
  for (let i = 0; i < ROWS.length; i++) {
    const km = fastKm(lat, lon, ROWS[i][1], ROWS[i][2], cosLat);
    if (km < bestKm) {
      best = i;
      bestKm = km;
    }
  }
  return { place: getPlace(best), km: bestKm };
}

/**
 * Приблизителен радиус (км) на населеното място около точката му в OpenStreetMap.
 * Всяко място е само една точка (центърът), а големият град е широк километри:
 * в Младост си на 9 км от центъра на София и по-близо до точката на село Герман.
 */
const CITY_RADIUS_KM: Record<string, number> = {
  София: 12,
  Пловдив: 6,
  Варна: 7,
  Бургас: 6,
  Русе: 5,
  'Стара Загора': 4,
  Плевен: 4,
  Сливен: 3.5,
  Добрич: 3.5,
  Шумен: 3.5,
  Перник: 3.5,
  Хасково: 3.5,
  Ямбол: 3.5,
  Пазарджик: 3.5,
  Благоевград: 3.5,
  'Велико Търново': 3.5,
  Габрово: 4,
  Смолян: 4,
  Кърджали: 3,
  Кюстендил: 3,
  Враца: 3,
  Видин: 3,
  Монтана: 3,
  Ловеч: 3,
  Силистра: 3,
  Търговище: 3,
  Разград: 3,
  Казанлък: 3,
  Асеновград: 3,
  Дупница: 3,
  'Горна Оряховица': 3,
  Димитровград: 3,
};
const TOWN_RADIUS_KM = 2;
const VILLAGE_RADIUS_KM = 1;
const HAMLET_RADIUS_KM = 0.4;

function radiusKm(row: Row): number {
  if (row[5] === 0) return CITY_RADIUS_KM[row[0]] ?? TOWN_RADIUS_KM;
  return row[5] === 1 ? VILLAGE_RADIUS_KM : HAMLET_RADIUS_KM;
}

/**
 * В кое населено място съм по GPS.
 * 1. Ако съм в радиуса на едно или повече места – мястото, спрямо което съм
 *    „най-навътре“ (разстояние / радиус). В Младост → София; в Кубратово,
 *    което е в радиуса на София, но на 0,2 км от центъра си → Кубратово.
 * 2. Иначе – мястото с най-малко разстояние до края му (разстояние − радиус).
 */
export function placeAt(lat: number, lon: number): Place {
  let inside = -1;
  let insideRatio = Infinity;
  let outside = 0;
  let outsideGap = Infinity;
  const cosLat = Math.cos((lat * Math.PI) / 180);
  for (let i = 0; i < ROWS.length; i++) {
    const km = fastKm(lat, lon, ROWS[i][1], ROWS[i][2], cosLat);
    const r = radiusKm(ROWS[i]);
    if (km <= r) {
      if (km / r < insideRatio) {
        inside = i;
        insideRatio = km / r;
      }
    } else if (km - r < outsideGap) {
      outside = i;
      outsideGap = km - r;
    }
  }
  return getPlace(inside >= 0 ? inside : outside);
}

/**
 * В България ли е точката. Границата сама не стига: опростената брегова линия
 * „изрязва“ някои плажове и крайбрежни селища (Балчик, Равда). Затова точка,
 * която е на под 1,5 км от българско населено място, също се брои за България.
 * 1,5 км е под разстоянието от Промахон (Гърция) до Кулата (2,1 км).
 */
export function isInBulgaria(lat: number, lon: number): boolean {
  if (!nearBulgaria(lat, lon)) return false; // Истанбул, Единбург… – без да обхождаме 6 700 места
  if (insideBorder(lat, lon)) return true;
  return nearestPlace(lat, lon).km < 1.5;
}

/** Името на мястото на двата езика и уточнение (община, област) – за различаване на еднакви имена. */
export function placeToLocation(place: Place): AppLocation {
  const cityLike = place.kind === 0;
  // турски: традиционното име на града (Кърджали → Kırcaali), иначе латиницата
  const trOr = (name: string) => TR_PLACE_NAMES[name] ?? transliterate(name);
  const trName = cityLike ? TR_PLACE_NAMES[place.name] : undefined;
  return {
    id: `bg-${place.index}`,
    names: { bg: place.name, en: transliterate(place.name), ...(trName ? { tr: trName } : {}) },
    detail: {
      bg: cityLike ? `обл. ${place.oblast}` : `общ. ${place.obshtina}, обл. ${place.oblast}`,
      en: cityLike
        ? `${transliterate(place.oblast)} Province`
        : `${transliterate(place.obshtina)}, ${transliterate(place.oblast)} Province`,
      tr: cityLike ? `${trOr(place.oblast)} ili` : `${trOr(place.obshtina)}, ${trOr(place.oblast)} ili`,
    },
    latitude: place.lat,
    longitude: place.lon,
    source: 'mufti',
    muftiShift: muftiShiftFor(place.lat, place.lon),
  };
}

/** Турските букви → латински: „Kırcaali“ се намира и като „kircaali“. */
function foldTurkish(text: string): string {
  return text
    .replace(/\u0307/g, '') // „İ“.toLowerCase() → „i̇“
    .replace(/ı/g, 'i')
    .replace(/ş/g, 's')
    .replace(/ç/g, 'c')
    .replace(/ğ/g, 'g')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u');
}

/** София-град от списъка – мястото по подразбиране, докато няма GPS или избор. */
export function defaultPlace(): Place {
  const i = ROWS.findIndex((r) => r[0] === 'София' && r[5] === 0);
  return getPlace(i);
}

// Индексът за търсене: 6 700 транслитерации – на компютъра ~50 ms, на телефона
// няколкостотин ms. Строи се на части, за да не блокира екрана (виж warmSearchIndex).
const searchIndex: { bg: string; lat: string; tr: string }[] = [];
const CHUNK = 500;

function buildMore(count: number): void {
  const end = Math.min(ROWS.length, searchIndex.length + count);
  for (let i = searchIndex.length; i < end; i++) {
    const trName = ROWS[i][5] === 0 ? TR_PLACE_NAMES[ROWS[i][0]] : undefined;
    searchIndex.push({
      bg: normalizeForSearch(ROWS[i][0]),
      lat: normalizeForSearch(transliterate(ROWS[i][0])),
      // турското име на града – и с, и без турските букви („kırcaali“, „kircaali“)
      tr: trName ? foldTurkish(normalizeForSearch(trName)) : '',
    });
  }
}

export function isSearchIndexReady(): boolean {
  return searchIndex.length === ROWS.length;
}

function index() {
  if (!isSearchIndexReady()) buildMore(ROWS.length); // търсене преди края – довършва наведнъж
  return searchIndex;
}

let warming: Promise<void> | null = null;
/**
 * Строи индекса на части от по 500 места, с пауза между тях – екранът и клавиатурата
 * остават живи. Вика се при отваряне на екрана за търсене; обещанието се изпълнява, когато е готов.
 */
export function warmSearchIndex(): Promise<void> {
  if (isSearchIndexReady()) return Promise.resolve();
  if (!warming) {
    warming = new Promise((resolve) => {
      const step = () => {
        buildMore(CHUNK);
        if (isSearchIndexReady()) resolve();
        else setTimeout(step, 0);
      };
      setTimeout(step, 0);
    });
  }
  return warming;
}

/*
 * Подредбата по азбука е направена в places.json при подготовката на данните.
 * Тук НЕ се ползва localeCompare: в Hermes (JS машината на телефона) всяко
 * localeCompare(…, 'bg') създава нов collator и е много бавно – сортирането на
 * 875 резултата за „ch“ замразяваше екрана за няколко секунди.
 * Затова при равенство се сравнява само индексът (= азбучният ред).
 */

let cities: Place[] | null = null;
/** Всички 256 града по азбучен ред – показват се, докато няма търсене. */
export function allCities(): Place[] {
  if (!cities) {
    cities = [];
    for (let i = 0; i < ROWS.length; i++) if (ROWS[i][5] === 0) cities.push(getPlace(i));
  }
  return cities;
}

/**
 * Търсене по име на кирилица или латиница („чеп“, „chep“).
 * Подредба: точно съвпадение → започва с → съдържа; при равенство – градове
 * преди села, после по азбука.
 */
export function searchPlaces(query: string, limit = 40): Place[] {
  const q = normalizeForSearch(query);
  if (q.length < 2) return [];
  const qt = foldTurkish(q);
  const idx = index();
  const hits: { i: number; rank: number }[] = [];
  for (let i = 0; i < idx.length; i++) {
    const { bg, lat, tr } = idx[i];
    let rank = -1;
    if (bg === q || lat === q || (tr && tr === qt)) rank = 0;
    else if (bg.startsWith(q) || lat.startsWith(q) || (tr && tr.startsWith(qt))) rank = 1;
    else if (bg.includes(q) || lat.includes(q) || (tr && tr.includes(qt))) rank = 2;
    if (rank >= 0) hits.push({ i, rank: rank * 10 + ROWS[i][5] });
  }
  hits.sort((a, b) => a.rank - b.rank || a.i - b.i);
  return hits.slice(0, limit).map((h) => getPlace(h.i));
}
