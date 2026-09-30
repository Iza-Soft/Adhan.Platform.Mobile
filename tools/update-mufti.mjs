// Обновява src/data/mufti.json от сайта на Главно мюфтийство.
// Пуска се ръчно, когато Мюфтийството промени календара си:  node tools/update-mufti.mjs
//
// Как работи:
// 1. За всеки град и всеки месец изпраща същата заявка като формата на сайта (POST month, town).
// 2. Сайтът показва часовете с лятното време вътре – превръщаме всичко в зимно време (UTC+2).
//    Датите на смяна откриваме от самата таблица (скок от ~60 мин. при Зухр).
// 3. Проверява, че всеки град = София + постоянна разлика. Ако не е – спира с грешка.
// 4. Записва таблицата на София и разликите; имената и координатите остават от стария файл.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const URL_ = 'https://www.grandmufti.bg/bg/home/vremena-za-namaz.html';
const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, '../src/data/mufti.json');
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]; // 29.02 не се пази

const old = JSON.parse(fs.readFileSync(OUT, 'utf8'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchMonth(town, month) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(URL_, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: `month=${month}&town=${encodeURIComponent(town)}`,
      });
      const html = await res.text();
      const start = html.indexOf('<table');
      if (start < 0) throw new Error('няма таблица');
      const table = html.slice(start, html.indexOf('</table>', start));
      const rows = [...table.matchAll(/<tr[\s\S]*?<\/tr>/g)]
        .map((m) => [...m[0].matchAll(/<td[\s\S]*?<\/td>/g)].map((c) => c[0].replace(/<[^>]+>/g, '').trim()))
        .filter((cells) => cells.length === 7 && Number(cells[0]) >= 1);
      return rows.map((cells) =>
        cells.slice(1).map((t) => {
          const [h, m] = t.split(':').map(Number);
          if (Number.isNaN(h) || Number.isNaN(m)) throw new Error(`лош час „${t}“`);
          return h * 60 + m;
        }),
      );
    } catch (err) {
      console.error(`  ${town} ${month}: ${err.message} (опит ${attempt})`);
      await sleep(2000 * attempt);
    }
  }
  throw new Error(`Неуспешно сваляне: ${town}, месец ${month}`);
}

async function fetchYear(town) {
  const rows = [];
  for (let m = 1; m <= 12; m++) {
    const month = await fetchMonth(town, m);
    if (month.length < DAYS_IN_MONTH[m - 1]) throw new Error(`${town} ${m}: само ${month.length} дни`);
    rows.push(...month.slice(0, DAYS_IN_MONTH[m - 1]));
    await sleep(200);
  }
  return rows;
}

/** Индексите [начало, край) на лятното време в таблицата – там, където Зухр скача с ~60 мин. */
function dstRange(rows) {
  let start = -1;
  let end = -1;
  for (let i = 1; i < rows.length; i++) {
    const jump = rows[i][2] - rows[i - 1][2];
    if (jump > 40) start = i;
    if (jump < -40) end = i;
  }
  if (start < 0 || end < 0) throw new Error('Не открих смяната на часовото време в таблицата');
  return [start, end];
}

const tables = {};
for (const t of old.towns) {
  process.stdout.write(`${t.bg} `);
  tables[t.id] = await fetchYear(t.id);
}
console.log();

const [ds, de] = dstRange(tables.sofia);
for (const id of Object.keys(tables)) {
  tables[id] = tables[id].map((r, i) => (i >= ds && i < de ? r.map((v) => v - 60) : r));
}
const sofia = tables.sofia;
sofia.forEach((r, i) => {
  for (let k = 1; k < 6; k++) if (r[k] <= r[k - 1]) throw new Error(`София, ден ${i + 1}: часовете не са подредени`);
});

const towns = old.towns.map((t) => {
  const diffs = new Set(tables[t.id].flatMap((r, i) => r.map((v, k) => v - sofia[i][k])));
  if (diffs.size !== 1) throw new Error(`${t.bg} не е постоянна разлика спрямо София: ${[...diffs].join(', ')}`);
  return { ...t, shift: [...diffs][0] };
});

const changed = JSON.stringify(old.sofia) !== JSON.stringify(sofia) ||
  JSON.stringify(old.towns) !== JSON.stringify(towns);
const out = { ...old, retrieved: new Date().toISOString().slice(0, 10), sofia, towns };
fs.writeFileSync(OUT, JSON.stringify(out));
console.log(changed ? 'Календарът е ПРОМЕНЕН – пусни тестовете (npm test) и провери разликите.' : 'Без промяна в календара.');
