/**
 * Офлайн списъкът на градовете по света (извън България) – src/data/world-cities.json.
 *
 * Източник: GeoNames (CC BY 4.0) през npm пакета all-the-cities (градове с поне 1000 жители).
 * Вземат се градовете с поне 15 000 жители и всички столици/областни центрове.
 * Имената на държавите на български и английски – от Intl.DisplayNames на Node.
 *
 * Пускане (веднъж, когато трябва да се обнови):
 *   npm i --no-save all-the-cities@3.1.0 pbf@3
 *   node tools/build-world-cities.mjs
 */
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const all = require('all-the-cities');

const MIN_POPULATION = 15000;
const keep = all.filter(
  (c) =>
    c.country !== 'BG' && // България е с подробния списък на селищата (places.json)
    c.name &&
    (c.population >= MIN_POPULATION || c.featureCode === 'PPLC' || c.featureCode === 'PPLA'),
);
// по-големите първо – при еднакво разстояние печели по-известният
keep.sort((a, b) => b.population - a.population);

const names = [];
let cc = '';
const lat = [];
const lon = [];
const countries = new Set();
for (const c of keep) {
  names.push(c.name.replace(/\n/g, ' '));
  cc += c.country;
  lon.push(Math.round(c.loc.coordinates[0] * 100));
  lat.push(Math.round(c.loc.coordinates[1] * 100));
  countries.add(c.country);
}

const bg = new Intl.DisplayNames(['bg'], { type: 'region' });
const en = new Intl.DisplayNames(['en'], { type: 'region' });
const countryNames = {};
for (const code of [...countries].sort()) {
  countryNames[code] = [bg.of(code) ?? code, en.of(code) ?? code];
}

const out = {
  source: 'GeoNames (CC BY 4.0) via all-the-cities',
  count: names.length,
  names: names.join('\n'),
  cc,
  lat,
  lon,
  countries: countryNames,
};
writeFileSync(new URL('../src/data/world-cities.json', import.meta.url), JSON.stringify(out));
console.log(`${names.length} cities, ${countries.size} countries`);
