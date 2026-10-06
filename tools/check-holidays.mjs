// Годишна проверка на датите на празниците (етап 13):  node tools/check-holidays.mjs [година]
//
// Сравнява таблицата на месеците по Хиджра в src/data/hijri.json (Диянет – по нея са и
// празниците, и датата по Хиджра в приложението) с обявения календар на Диянет.
// Пуска се веднъж годишно (януари) – за текущата и следващата година, ако не е дадена година.
//
// Откъде: Aladhan API, методът DIYANET – публикува календара на Диянет
// (https://api.aladhan.com/v1/islamicCalendar/methods). За всеки месец по Хиджра
// пита коя е датата на 1-во число и я сравнява с нашата.
//
// Резултат:
// - „OK“ – всичко съвпада, нищо не се променя;
// - разлика – показва я; с `--fix` записва датата на Диянет в src/data/hijri.json
//   (после: npm test, commit и нова версия на приложението);
// - месец, който Диянет още не е обявил – отбелязва се, не е грешка.
// `--self-test` – проверява самия скрипт без интернет (сравнява таблицата със себе си).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(here, '../src/data/hijri.json');
const API = 'https://api.aladhan.com/v1/hToG';

const args = process.argv.slice(2);
const fix = args.includes('--fix');
const selfTest = args.includes('--self-test');
const years = args.filter((a) => /^\d{4}$/.test(a)).map(Number);
if (!years.length) {
  const y = new Date().getFullYear();
  years.push(y, y + 1);
}

const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const table = data.diyanet;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pad = (n) => String(n).padStart(2, '0');

/** Месеците от таблицата, чието 1-во число е в дадената година: { index, year, month, date }. */
function monthsIn(year) {
  const out = [];
  table.months.forEach((date, i) => {
    if (Number(date.slice(0, 4)) !== year) return;
    out.push({ index: i, year: table.firstYear + Math.floor(i / 12), month: (i % 12) + 1, date });
  });
  return out;
}

/** 1-во число на месеца по Диянет (ISO) или null – още не е обявено / извън календара. */
async function diyanetStart(hYear, hMonth) {
  if (selfTest) return table.months[(hYear - table.firstYear) * 12 + hMonth - 1];
  const url = `${API}/01-${pad(hMonth)}-${hYear}?calendarMethod=DIYANET`;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(url, { headers: { accept: 'application/json' } });
      const json = await res.json();
      if (json.code !== 200 || !json.data?.gregorian?.date) return null;
      const [d, m, y] = json.data.gregorian.date.split('-');
      return `${y}-${m}-${d}`;
    } catch (e) {
      if (attempt === 4) throw new Error(`${url}: ${e.message}`);
      await sleep(1500 * attempt);
    }
  }
  return null;
}

let diffs = 0;
let pending = 0;
let checked = 0;
for (const year of years) {
  console.log(`\n${year}`);
  for (const m of monthsIn(year)) {
    const theirs = await diyanetStart(m.year, m.month);
    await sleep(selfTest ? 0 : 400);
    const label = `  1.${pad(m.month)}.${m.year}`;
    if (!theirs) {
      pending++;
      console.log(`${label}  приложението ${m.date}  · Диянет още не е обявил`);
      continue;
    }
    checked++;
    if (theirs === m.date) {
      console.log(`${label}  ${m.date}  OK`);
      continue;
    }
    diffs++;
    console.log(`${label}  РАЗЛИКА: Диянет ${theirs}, приложението ${m.date}`);
    if (fix) table.months[m.index] = theirs;
  }
}

console.log(`\nПроверени ${checked}, разлики ${diffs}, още необявени ${pending}.`);
if (diffs && fix) {
  fs.writeFileSync(FILE, JSON.stringify(data) + '\n');
  console.log('src/data/hijri.json е поправен. Пусни npm test, после commit и нова версия.');
} else if (diffs) {
  console.log('Пусни отново с --fix, за да се запишат датите на Диянет.');
  process.exitCode = 1;
} else {
  console.log('OK – празниците и датата по Хиджра съвпадат с Диянет.');
}
