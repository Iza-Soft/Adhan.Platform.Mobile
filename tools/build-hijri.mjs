/**
 * Таблицата на месеците по Хиджра (етап 13) → src/data/hijri.json
 *
 *   npm i --no-save astronomy-engine
 *   node tools/build-hijri.mjs
 *
 * 1) Диянет (и Главно мюфтийство в България – ползва същия календар): правилата на
 *    Единния календар по Хиджра (Истанбул, 2016), както ги прилага Диянет:
 *    - месецът започва на следващия ден, ако някъде по света при залез преди 00:00 UTC
 *      Луната е на ≥ 8° от Слънцето (елонгация, геоцентрично) и на ≥ 5° над хоризонта;
 *    - изключение: ако това е изпълнено след 00:00 UTC, но в Америка (континента),
 *      и новолунието е преди зората (Фаджр) в Нова Зеландия – месецът също започва.
 *    Проверено срещу 43 обявени от Диянет дати (2021–2027) – всички съвпадат (виж REFERENCE).
 *    Диянет е обявил официално датите до Шабан 1449 (януари 2028); по-нататък са по същите правила.
 * 2) Умм ал-Кура (Саудитска Арабия): официалната таблица от ICU в Node (Intl, islamic-umalqura).
 *
 * Изчислението е бавно (~15 мин.) – мрежа 1°×1° по цялото земно кълбо за всяко новолуние.
 */
import { writeFileSync } from 'node:fs';
import * as A from 'astronomy-engine';

const FROM_YEAR = 2015;
const TO_YEAR = 2046;
const DAY = 86400000;
const STEP = 1;

/** Обявени от Диянет начала на месеци (Gregorian), от „dini günler“ за съответната година. */
const REFERENCE = [
  '2021-02-13', '2021-03-14', '2021-04-13', '2021-05-13', '2021-07-11', '2021-08-09', '2021-10-07',
  '2022-02-02', '2022-03-04', '2022-04-02', '2022-05-02', '2022-06-30', '2022-07-30', '2022-09-27',
  '2023-01-23', '2023-02-21', '2023-03-23', '2023-04-21', '2023-06-19', '2023-07-19', '2023-09-16',
  '2024-03-11', '2024-04-10', '2024-06-07', '2024-07-07', '2024-09-04',
  '2025-03-01', '2025-03-30', '2025-05-28', '2025-06-26', '2025-08-24', '2025-12-21',
  '2026-01-20', '2026-02-19', '2026-03-20', '2026-05-18', '2026-06-16', '2026-08-14', '2026-12-10',
  '2027-02-08', '2027-03-09', '2027-05-07', '2027-06-06',
];
/** Котва за номерацията: 1 Мухаррем 1448 = 16.06.2026 (Диянет). */
const ANCHOR = { date: '2026-06-16', year: 1448, month: 1 };

const iso = (ms) => new Date(ms).toISOString().slice(0, 10);

function criterionMet(conjMs, localDayMs, fromMs, toMs, lon0, lon1, lat0, lat1) {
  for (let lat = lat0; lat <= lat1; lat += STEP) {
    for (let lon = lon0; lon <= lon1; lon += STEP) {
      const obs = new A.Observer(lat, lon, 0);
      // залезът в местния ден: търсим от ~06:00 местно време
      const start = localDayMs - (lon / 15) * 3600000 + 6 * 3600000;
      const sunset = A.SearchRiseSet(A.Body.Sun, obs, -1, new A.AstroTime(new Date(start)), 1);
      if (!sunset) continue;
      const t = sunset.date.getTime();
      if (t < fromMs || t >= toMs || t <= conjMs) continue;
      const moon = A.Equator(A.Body.Moon, sunset, obs, true, true);
      const altitude = A.Horizon(sunset, obs, moon.ra, moon.dec).altitude;
      if (altitude < 5) continue;
      if (A.AngleFromSun(A.Body.Moon, sunset) >= 8) return true;
    }
  }
  return false;
}

/** Първият ден на месеца след новолунието `conj` (UTC дата, ISO). */
function diyanetMonthStart(conj) {
  const c = conj.date.getTime();
  const d0 = Math.floor(c / DAY) * DAY;
  const nz = new A.Observer(-41.3, 174.8, 0);
  for (let k = 0; k < 3; k++) {
    const day = d0 + k * DAY;
    const next = day + DAY;
    if (criterionMet(c, day, day - 12 * 3600000, next, -180, 180, -60, 60)) return iso(next);
    if (criterionMet(c, day, next, next + 12 * 3600000, -125, -35, -56, 60)) {
      const fajr = A.SearchAltitude(A.Body.Sun, nz, +1, new A.AstroTime(new Date(next - 14 * 3600000)), 1, -18);
      if (fajr && c < fajr.date.getTime()) return iso(next);
    }
  }
  throw new Error(`no month start after ${conj.date.toISOString()}`);
}

function diyanetTable() {
  const starts = [];
  let t = A.SearchMoonPhase(0, new A.AstroTime(new Date(Date.UTC(FROM_YEAR, 0, 1))), 40);
  const end = Date.UTC(TO_YEAR + 1, 0, 1);
  while (t && t.date.getTime() < end) {
    starts.push(diyanetMonthStart(t));
    process.stdout.write(`\r${starts.at(-1)}`);
    t = A.SearchMoonPhase(0, t.AddDays(1), 40);
  }
  process.stdout.write('\n');
  const missing = REFERENCE.filter((d) => !starts.includes(d));
  if (missing.length) throw new Error(`не съвпада с Диянет: ${missing.join(', ')}`);
  const a = starts.indexOf(ANCHOR.date);
  // първият месец на таблицата – началото на хиджри година (Мухаррем)
  const firstMuharram = a % 12;
  const months = starts.slice(firstMuharram);
  const firstYear = ANCHOR.year - (a - firstMuharram) / 12;
  return { firstYear, months };
}

function ummAlQuraTable() {
  const f = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { day: 'numeric', month: 'numeric', year: 'numeric', timeZone: 'UTC' });
  const months = [];
  let firstYear = null;
  for (let d = Date.UTC(FROM_YEAR, 0, 1); d < Date.UTC(TO_YEAR + 1, 1, 1); d += DAY) {
    const p = f.formatToParts(new Date(d));
    const get = (k) => Number(p.find((x) => x.type === k).value);
    if (get('day') !== 1) continue;
    if (firstYear === null) {
      if (get('month') !== 1) continue;
      firstYear = get('year');
    }
    months.push(iso(d));
  }
  return { firstYear, months };
}

const diyanet = diyanetTable();
const ummalqura = ummAlQuraTable();
writeFileSync(
  new URL('../src/data/hijri.json', import.meta.url),
  JSON.stringify({
    source: 'tools/build-hijri.mjs – Диянет (правилата от 2016, проверени срещу обявените дати) и Умм ал-Кура (ICU)',
    diyanet: { ...diyanet, officialUntil: [1449, 8] },
    ummalqura,
  }) + '\n',
);
console.log(`diyanet ${diyanet.firstYear}: ${diyanet.months.length} месеца · umm al-qura ${ummalqura.firstYear}: ${ummalqura.months.length}`);
