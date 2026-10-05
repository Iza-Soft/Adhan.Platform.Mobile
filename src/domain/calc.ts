import {
  CalculationMethod,
  Coordinates,
  HighLatitudeRule,
  Madhab,
  PolarCircleResolution,
  PrayerTimes,
} from 'adhan';

import type { AppLocation } from './location';
import { PRAYER_IDS, type PrayerTime } from './prayers';

/** Методите, които се предлагат в настройките (извън България). */
export const CALC_METHODS = [
  'Turkey',
  'MuslimWorldLeague',
  'NorthAmerica',
  'UmmAlQura',
  'Egyptian',
  'Karachi',
  'MoonsightingCommittee',
  'Dubai',
  'Kuwait',
  'Qatar',
  'Singapore',
  'Tehran',
  'France',
  'Russia',
  'Malaysia',
  'Indonesia',
] as const;
export type CalculationMethodId = (typeof CALC_METHODS)[number];

/** В настройките: конкретен метод или „Автоматично“ – според държавата. */
export type MethodChoice = CalculationMethodId | 'auto';

/**
 * Методите, които ги няма в adhan – ъглите на Слънцето под хоризонта за Фаджр и Иша.
 * Франция – UOIF (12°/12°); Русия – Духовното управление на мюсюлманите (16°/15°);
 * Малайзия – JAKIM и Индонезия – Kemenag (20°/18°).
 */
const CUSTOM_ANGLES: Partial<Record<CalculationMethodId, [number, number]>> = {
  France: [12, 12],
  Russia: [16, 15],
  Malaysia: [20, 18],
  Indonesia: [20, 18],
};

function methodParams(method: CalculationMethodId) {
  const custom = CUSTOM_ANGLES[method];
  if (custom) {
    const params = CalculationMethod.Other();
    params.fajrAngle = custom[0];
    params.ishaAngle = custom[1];
    return params;
  }
  return CalculationMethod[method as Exclude<CalculationMethodId, 'France' | 'Russia' | 'Malaysia' | 'Indonesia'>]();
}

/** Европа (без Франция, Великобритания и Ирландия): Диянет – както в джамиите на Диянет в Европа. */
const EUROPE_DIYANET = new Set(
  'AD AL AT AZ BA BE BY CH CY CZ DE DK EE ES FI GE GR HR HU IS IT LI LT LU LV MC MD ME MK MT NL NO PL PT RO RS SE SI SK SM UA VA XK TR'.split(
    ' ',
  ),
);

const BY_COUNTRY: Record<string, CalculationMethodId> = {
  US: 'NorthAmerica',
  CA: 'NorthAmerica',
  SA: 'UmmAlQura',
  EG: 'Egyptian',
  PK: 'Karachi',
  IN: 'Karachi',
  BD: 'Karachi',
  AF: 'Karachi',
  FR: 'France',
  GB: 'MoonsightingCommittee',
  IE: 'MoonsightingCommittee',
  RU: 'Russia',
  MY: 'Malaysia',
  BN: 'Malaysia',
  ID: 'Indonesia',
  AE: 'Dubai',
  KW: 'Kuwait',
  QA: 'Qatar',
  SG: 'Singapore',
  IR: 'Tehran',
};

/** Методът по подразбиране за държавата (ISO код). Непозната – Muslim World League. */
export function methodForCountry(country: string | null | undefined): CalculationMethodId {
  const c = country?.toUpperCase() ?? '';
  if (BY_COUNTRY[c]) return BY_COUNTRY[c];
  if (EUROPE_DIYANET.has(c)) return 'Turkey';
  return 'MuslimWorldLeague';
}

export type AsrMadhab = 'shafi' | 'hanafi';

/** Правило за северни ширини – как се смятат Фаджр и Иша, когато няма истински здрач. */
export const HIGH_LAT_RULES = ['seventhofthenight', 'middleofthenight', 'twilightangle'] as const;
export type HighLatRuleId = (typeof HIGH_LAT_RULES)[number];

/** Над тази ширина (на север или юг) настройката „северни ширини“ има значение и се показва. */
export const HIGH_LATITUDE = 48;

export function isHighLatitude(lat: number): boolean {
  return Math.abs(lat) > HIGH_LATITUDE;
}

/**
 * Над тази ширина има полярен ден и полярна нощ (Тромсьо, Норилск, Свалбард, полюсите).
 * В дните, в които изчислението за истинската ширина не става (няма изгрев/залез,
 * разбъркан ред), часовете са за същата дължина, но на 65° – най-близките места
 * с нормален ден и нощ („най-близката страна“, aqrab al-bilad).
 */
export const POLAR_LATITUDE = 65;

export function isPolar(lat: number): boolean {
  return Math.abs(lat) > POLAR_LATITUDE;
}

/**
 * Полярен ден или полярна нощ – слънцето този ден не изгрява или не залязва.
 * Деклинацията на слънцето е приблизителна (±0,5°), затова има запас от 1,5°:
 * в граничните дни също се минава на 65°, вместо да се търсят часове от други дни
 * (това търсене в adhan е бавно – месец на Свалбард отнемаше ~0,5 сек. на компютър).
 */
export function isPolarDayOrNight(date: Date, lat: number): boolean {
  const start = new Date(date.getFullYear(), 0, 1);
  const dayOfYear = Math.round((date.getTime() - start.getTime()) / 86_400_000) + 1;
  const decl = 23.44 * Math.sin(((2 * Math.PI) / 365) * (284 + dayOfYear));
  return Math.abs(lat) > 90 - Math.abs(decl) - 1.5;
}

/** Всички часове са истински дати и вървят по ред: Фаджр < Изгрев < Зухр < Аср < Магриб < Иша. */
export function isValidDay(times: PrayerTime[]): boolean {
  return times.every(
    (p, i) => !isNaN(p.time.getTime()) && (i === 0 || p.time.getTime() > times[i - 1].time.getTime()),
  );
}

/**
 * Астрономическо изчисление с adhan – за места извън България.
 * Методът „Turkey“ (Диянет) вече съдържа предпазните минути (темкин) на Диянет.
 * Сравнено с календара на Мюфтийството за София, средната разлика е ~0,
 * но в отделни дни стига 2–4 мин. (виж PLAN.md, етап 2).
 */
export function computeCalcDay(
  date: Date,
  location: AppLocation,
  method: CalculationMethodId,
  madhab: AsrMadhab,
  highLatRule: HighLatRuleId = 'seventhofthenight',
): PrayerTime[] {
  const lat = location.latitude;
  const sign = lat < 0 ? -1 : 1;
  // Полярен ден/нощ → направо 65°. Иначе първо истинската ширина; ако денят излезе
  // невалиден (липсващ час или разбъркан ред) – 65°, а ако и там не стане – още по-близо до екватора.
  let tryLat = isPolar(lat) && isPolarDayOrNight(date, lat) ? sign * POLAR_LATITUDE : lat;
  for (;;) {
    const times = calcAt(date, tryLat, location.longitude, method, madhab, highLatRule);
    if (isValidDay(times) || Math.abs(tryLat) <= HIGH_LATITUDE) return times;
    tryLat = sign * Math.min(Math.abs(tryLat) - 1, POLAR_LATITUDE);
  }
}

function calcAt(
  date: Date,
  latitude: number,
  longitude: number,
  method: CalculationMethodId,
  madhab: AsrMadhab,
  highLatRule: HighLatRuleId,
): PrayerTime[] {
  const params = methodParams(method);
  params.madhab = madhab === 'hanafi' ? Madhab.Hanafi : Madhab.Shafi;
  if (isHighLatitude(latitude)) {
    params.highLatitudeRule =
      highLatRule === 'middleofthenight'
        ? HighLatitudeRule.MiddleOfTheNight
        : highLatRule === 'twilightangle'
          ? HighLatitudeRule.TwilightAngle
          : HighLatitudeRule.SeventhOfTheNight;
    // резерва за граничните дни около полярния кръг – най-близкият ден с нормални часове
    params.polarCircleResolution = PolarCircleResolution.AqrabYaum;
  }
  const coords = new Coordinates(latitude, longitude);
  // обяд, за да не може смяната на лятно/зимно време да измести датата
  const noon = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  const pt = new PrayerTimes(coords, noon, params);
  return PRAYER_IDS.map((id) => ({ id, time: pt[id] }));
}
